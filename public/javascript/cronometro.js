document.addEventListener("DOMContentLoaded", () => {
  const socket = io("http://localhost:3000");
  let elapsedTime = moment.duration(0);
  const elapsedTimeElement = document.getElementById("elapsedTime");

  socket.on("updateStatus", (data) => {
    if (data.status === "started" || data.status === "resumed") {
      // Iniciar o reanudar el cronómetro cada minuto
      const updateInterval = setInterval(() => {
        elapsedTime.add(1, "minute");
        updateElapsedTime();
      }, 60000);

      // Detener el cronómetro si el estado cambia
      socket.on("updateStatus", (newData) => {
        if (newData.status !== "started" && newData.status !== "resumed") {
          clearInterval(updateInterval);
        }
      });
    } else {
      // Detener el cronómetro si el estado es otro
      clearInterval();
    }
  });

  function updateElapsedTime() {
    if (elapsedTimeElement) {
      const formattedTime = formatTimeWithMoment(elapsedTime);
      elapsedTimeElement.textContent = `Tiempo: ${formattedTime}`;
    }
  }

  function formatTimeWithMoment(time) {
    return moment.utc(time.asMilliseconds()).format("HH:mm");
  }
});
