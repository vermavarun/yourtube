import "./App.css";
import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState('');
  const vedo = React.createRef();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8080/videou',{headers: {range: 'bytes=0'}});

        vedo.current.src = URL.createObjectURL(await response.blob());

      } catch (error) {
        // Handle other errors
      }
    };

    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>{data}</p>
        <video ref={vedo} width="320" height="240" controls>
          <source src={data} type="video/mp4" />
          <track kind="captions" src="captions.vtt" label="English" />
        </video>
        <button>Get Data from Backend</button>
      </header>
    </div>
  );
}

export default App;
