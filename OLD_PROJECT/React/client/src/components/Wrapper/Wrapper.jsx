import React from "react";
import BGImage from "../BGImage/BGImage";
import "./Wrapper.css";

const Wrapper = (props) => {
  return (
    <div className="App-wrapper">
      <BGImage />
      <div>{props.children}</div>
    </div>
  );
};

export default Wrapper;
