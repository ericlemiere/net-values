import React from "react";
import "./App.css";
import Header from "./components/Header/Header";
import BGImage from "./components/BGImage/BGImage";
import { Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import Stats from "./components/Stats";
import AdvancedStats from "./components/AdvancedStats";
import Teams from "./components/Teams";

function App() {
  return (
    <div>
      <BGImage />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Stats" element={<Stats />} />
        <Route path="/AdvancedStats" element={<AdvancedStats />} />
        <Route path="/Teams" element={<Teams />} />
      </Routes>
    </div>
  );
}

export default App;
