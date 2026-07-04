import React, { useState } from "react";
import "./Overlay.css";

export default function Overlay({props}) {

  const [modal, setModal] = useState(false);

  const toggleModal = () => {
    setModal(!modal);
  };

  if(modal) {
    document.body.classList.add('active-modal')
  } else {
    document.body.classList.remove('active-modal')
  }

  return (
    <>
      <p onClick={toggleModal}>
        {props.Name}
      </p>

      {modal && (
        <div className="modal">
          <div onClick={toggleModal} className="overlay"></div>
          <div className="modal-content">
            <h2>{props.Name}</h2>
            <p>Team: {props.Team}</p>
            <p>VORP: {props.VORP}</p>
            <button className="close-modal" onClick={toggleModal}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}