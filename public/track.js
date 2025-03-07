fetch("/track")
  .then((response) => response.json())
  .then((data) => console.log("방문 기록:", data))
  .catch((error) => console.error("Error tracking visitor:", error));
