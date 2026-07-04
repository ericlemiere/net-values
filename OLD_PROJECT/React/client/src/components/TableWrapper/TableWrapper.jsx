import React from "react";
import "./TableWrapper.css";

const TableWrapper = (props) => {
  return (
    <div className="tableContainer">
      <table className="tableWrapper">{props.children}</table>
    </div>
  );
};

export default TableWrapper;
