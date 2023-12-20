const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const moment = require("moment-timezone");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

require("dotenv").config();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../css")));

const db = require("mariadb");
const pool = db.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 5,
});

// Almacén temporal para los estados de los empleados
const employeeStates = {};
let lastFetchDate = null; // Variable para almacenar la última fecha en que se cargaron los datos desde la base de datos

// Función para verificar si es un nuevo día
function isNewDay() {
  const currentDate = moment().tz("America/Montevideo").format("YYYY-MM-DD");
  return currentDate !== lastFetchDate;
}

// Endpoint para obtener la lista de usuarios activos desde el caché
app.get("/cachedUsers", async (req, res) => {
  if (isNewDay() || Object.keys(employeeStates).length === 0) {
    try {
      const connection = await pool.getConnection();
      const result = await connection.query(
        "SELECT userId FROM tiempos WHERE stopTime IS NULL"
      );
      connection.release();

      const activeUsers = result.map((row) => row.userId);
      lastFetchDate = moment().tz("America/Montevideo").format("YYYY-MM-DD");

      res.status(200).json({ activeUsers });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ message: "Error al obtener la lista de usuarios activos" });
    }
  } else {
    const activeUsers = Object.keys(employeeStates).filter(
      (userId) => employeeStates[userId].status !== "stopped"
    );
    res.status(200).json({ activeUsers });
  }
});

// Endpoint para actualizar el caché al iniciar, pausar, reanudar o detener un contador
app.post("/updateCache", async (req, res) => {
  const { userId, status } = req.body;

  // Actualizar el caché según el evento
  if (status === "started" || status === "paused" || status === "resumed") {
    employeeStates[userId] = {
      status,
      startTime: moment()
        .tz("America/Montevideo")
        .format("YYYY-MM-DD HH:mm:ss"),
    };
  } else if (status === "stopped") {
    // Actualizar el caché y enviar datos acumulados a la base de datos al detener el contador
    const currentTime = moment()
      .tz("America/Montevideo")
      .format("YYYY-MM-DD HH:mm:ss");
    const accumulatedData = employeeStates[userId];
    accumulatedData.status = "stopped";
    accumulatedData.stopTime = currentTime;

    try {
      const connection = await pool.getConnection();

      // Realizar la actualización en la base de datos aquí si es necesario
      await connection.query(
        "UPDATE tiempos SET status = ?, startTime = ?, stopTime = ? WHERE userId = ? AND stopTime IS NULL",
        [accumulatedData.status, accumulatedData.startTime, currentTime, userId]
      );

      connection.release();
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error al detener el contador" });
      return;
    }

    // Limpiar el estado del empleado después de detener el contador
    delete employeeStates[userId];
  }

  res.status(200).send({ message: "Caché actualizado correctamente" });
});

// Endpoint para iniciar el contador
app.post("/start", async (req, res) => {
  const userId = req.body.userId;
  const currentTime = moment()
    .tz("America/Montevideo")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    const connection = await pool.getConnection();
    await connection.query(
      "INSERT INTO tiempos (userId, startTime) VALUES (?, ?)",
      [userId, currentTime]
    );
    connection.release();

    // Almacenar estado en memoria
    employeeStates[userId] = { status: "started", startTime: currentTime };

    io.emit("updateStatus", {
      userId,
      status: "started",
      startTime: currentTime,
    });
    io.emit("updateStartTime", { userId, startTime: currentTime });

    res.status(200).send({ message: "Contador iniciado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error al iniciar el contador" });
  }
});

// Endpoint para pausar el contador
app.post("/pause", async (req, res) => {
  const userId = req.body.userId;
  const currentTime = moment()
    .tz("America/Montevideo")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    const connection = await pool.getConnection();
    await connection.query(
      "UPDATE tiempos SET pauseTime = ?, elapsedTime = ? WHERE userId = ? AND pauseTime IS NULL AND stopTime IS NULL",
      [currentTime, elapsedTime, userId]
    );
    connection.release();

    io.emit("updateStatus", { userId, status: "paused", elapsedTime });
    res.status(200).send({ message: "Contador pausado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error al pausar el contador" });
  }
});

// Endpoint para reanudar el contador
app.post("/resume", async (req, res) => {
  const userId = req.body.userId;
  const currentTime = moment()
    .tz("America/Montevideo")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    const connection = await pool.getConnection();
    const [row] = await connection.query(
      "SELECT startTime FROM tiempos WHERE userId = ? AND pauseTime IS NOT NULL AND stopTime IS NULL",
      [userId]
    );

    if (row.length === 0) {
      connection.release();
      return res
        .status(404)
        .send({ message: "No se encontró un contador pausado para reanudar" });
    }

    await connection.query(
      "UPDATE tiempos SET elapsedTime = elapsedTime + TIMESTAMPDIFF(SECOND, pauseTime, ?), pauseTime = NULL WHERE userId = ? AND pauseTime IS NOT NULL AND stopTime IS NULL",
      [currentTime, userId]
    );

    connection.release();

    io.emit("updateStatus", { userId, status: "resumed" });
    res.status(200).send({ message: "Contador reanudado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error al reanudar el contador" });
  }
});

// Endpoint para detener el contador
app.post("/stop", async (req, res) => {
  const userId = req.body.userId;
  const currentTime = moment()
    .tz("America/Montevideo")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    const connection = await pool.getConnection();
    const [row] = await connection.query(
      "SELECT startTime FROM tiempos WHERE userId = ? AND stopTime IS NULL",
      [userId]
    );

    if (row.length === 0) {
      connection.release();
      return res
        .status(404)
        .send({ message: "No se encontró un contador en marcha para detener" });
    }

    await connection.query(
      "UPDATE tiempos SET stopTime = ?, elapsedTime = elapsedTime + TIMESTAMPDIFF(SECOND, startTime, ?) WHERE userId = ? AND stopTime IS NULL",
      [currentTime, currentTime, userId]
    );

    connection.release();

    io.emit("updateStatus", { userId, status: "stopped", elapsedTime });
    res.status(200).send({ message: "Contador detenido correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error al detener el contador" });
  }
});

io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado");

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
