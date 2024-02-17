import "./App.css";
import React, { useState } from "react";

function App() {
  const [data, setData] = useState(""); // [1]

  function getBackendData() {
    fetch("http://localhost:8080/")
      .then((response) => response.text())
      .then((data) => {
        console.log(data);
        setData(data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }
  return (
    <div className="App">
      <header className="App-header">
        <p>{data}</p>
        <video width="320" height="240" controls>
          <source src="http://localhost:8080/video" type="video/mp4" />
          <track kind="captions" src="captions.vtt" label="English" />
        </video>
        <button onClick={getBackendData}>Get Data from Backend</button>
      </header>
    </div>
  );
}

export default App;
