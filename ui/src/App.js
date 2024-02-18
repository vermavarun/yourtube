import React from "react";
import {
    Route,
    Routes,
    BrowserRouter as Router,
} from "react-router-dom";
import Videocomp  from "./videocomp";
import PageNotFound from "./PageNotFound";

function App() {
  return (
    <Router>
      <h1>Video Site</h1>

      <Routes>
        <Route exact path="/" element={<Videocomp />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
