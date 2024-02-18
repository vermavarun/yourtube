import "./App.css";
import React, { useState, useEffect } from "react";

function Videocomp() {
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

return(
<div className="App">
      <header className="App-header">
        <video ref={vedo} width="320" height="240" controls>
          <source type="video/mp4" />
          <track kind="captions" src="captions.vtt" label="English" />
        </video>
      </header>
    </div>
);
}
export default Videocomp;