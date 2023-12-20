document.addEventListener("DOMContentLoaded", () => {
  const socket = io("http://localhost:3000");

  socket.on("updateStatus", (data) => {
    const statusElement = document.getElementById("status");
    const startTimeElement = document.getElementById("startTime");

    if (statusElement && startTimeElement) {
      const formattedTime = formatTimeWithMoment(data.startTime);
      statusElement.textContent = `Estado: ${data.status}`;
      startTimeElement.textContent = `Inicio: ${formattedTime}`;
    }
  });

  function formatTimeWithMoment(time) {
    return moment(time).format("HH:mm:ss");
  }
});
