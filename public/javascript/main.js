document.addEventListener("DOMContentLoaded", async function () {
  // Función para cargar los usuarios dinámicamente
  async function loadUsers() {
    try {
      const response = await fetch("/cachedUsers"); // Usa el endpoint correspondiente
      const data = await response.json();
      const activeUsers = data.activeUsers;

      // Obtén la plantilla del usuario desde el template
      const template = document.getElementById("employee-template");

      // Obtén el contenedor de empleados
      const employeesContainer = document.querySelector(".employees-container");

      // Limpia el contenedor antes de agregar nuevos elementos
      employeesContainer.innerHTML = "";

      // Itera sobre los usuarios y crea elementos HTML dinámicamente
      activeUsers.forEach((userId) => {
        // Clona la plantilla
        const clone = document.importNode(template.content, true);

        // Modifica el contenido del clon con la información del usuario
        clone.querySelector(
          ".employee-name"
        ).textContent = `Usuario: ${userId}`;
        clone.querySelector(".status").textContent = "Estado: Desconocido";
        clone.querySelector(".startTime").textContent = "Inicio: 00:00:00";
        clone.querySelector(".elapsedTime").textContent = "Tiempo: 00:00";

        // Agrega el clon al contenedor de empleados
        employeesContainer.appendChild(clone);
      });
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    }
  }

  // Llama a la función para cargar usuarios al cargar la página
  await loadUsers();
});
