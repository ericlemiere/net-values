import React from "react";
import "./BGImage.css";
import logoJW from "./nba-logo-JW.png";

const BGImage = () => {
  return (
    <div className="bgContainer">
      <div className="bgLeft"></div>
      <div className="bgRight">
        <img src={logoJW} alt="JWlogo"></img>
      </div>
    </div>
  );
};

export default BGImage;
