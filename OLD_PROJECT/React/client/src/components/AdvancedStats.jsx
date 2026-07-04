import React, { useState, useEffect } from "react";
import Axios from "axios";
import "./AdvancedStats.css";
import Overlay from "./Modal/Overlay";
import Wrapper from "./Wrapper/Wrapper";
import TableWrapper from "./TableWrapper/TableWrapper";

const AdvancedStats = () => {
  const tableName = "AdvancedStats";
  const [playersList, setPlayersList] = useState([]);
  const [NameDesc, setNameDesc] = useState(false);
  const [PosDesc, setPosDesc] = useState(false);
  const [AgeDesc, setAgeDesc] = useState(true);
  const [TeamDesc, setTeamDesc] = useState(false);
  const [GPDesc, setGPDesc] = useState(true);
  const [MPDesc, setMPDesc] = useState(true);
  const [PERDesc, setPERDesc] = useState(true);
  const [TSDesc, setTSDesc] = useState(true);
  const [USGDesc, setUSGDesc] = useState(true);
  const [OWSDesc, setOWSDesc] = useState(true);
  const [DWSDesc, setDWSDesc] = useState(true);
  const [WSDesc, setWSDesc] = useState(true);
  const [OBPMDesc, setOBPMDesc] = useState(true);
  const [DBPMDesc, setDBPMDesc] = useState(true);
  const [BPMDesc, setBPMDesc] = useState(false);
  const [VORPDesc, setVORPDesc] = useState(true);

  const [season, setSeason] = useState(2023);

  const seasons = [
    { value: 2023, text: "2022-2023" },
    { value: 2022, text: "2021-2022" },
    { value: 2021, text: "2020-2021" },
    { value: 2020, text: "2019-2020" },
    { value: 2019, text: "2018-2019" },
    { value: 2018, text: "2017-2018" },
    { value: 2017, text: "2016-2017" },
    { value: 2016, text: "2015-2016" },
    { value: 2015, text: "2014-2015" },
    { value: 2014, text: "2013-2014" },
    { value: 2013, text: "2012-2013" },
    { value: 2012, text: "2011-2012" },
    { value: 2011, text: "2010-2011" },
    { value: 2010, text: "2009-2010" },
    { value: 2009, text: "2008-2009" },
    { value: 2008, text: "2007-2008" },
    { value: 2007, text: "2006-2007" },
    { value: 2006, text: "2005-2006" },
    { value: 2005, text: "2004-2005" },
    { value: 2004, text: "2003-2004" },
    { value: 2003, text: "2002-2003" },
    { value: 2002, text: "2001-2002" },
    { value: 2001, text: "2000-2001" },
    { value: 2000, text: "1999-2000" },
    { value: 1999, text: "1998-1999" },
    { value: 1998, text: "1997-1998" },
    { value: 1997, text: "1996-1997" },
    { value: 1996, text: "1995-1996" },
    { value: 1995, text: "1994-1995" },
    { value: 1994, text: "1993-1994" },
    { value: 1993, text: "1992-1993" },
    { value: 1992, text: "1991-1992" },
    { value: 1991, text: "1990-1991" },
    { value: 1990, text: "1989-1990" },
  ];

  const seasonChangeHandler = (event) => {
    // const seasonString = `${event.target.value - 1}-${event.target.value}`;
    setSeason(event.target.value);
    getPlayers(season);

    // Reset States for column sorting:
    setNameDesc(false);
    setPosDesc(false);
    setAgeDesc(true);
    setTeamDesc(false);
    setGPDesc(true);
    setMPDesc(true);
    setPERDesc(true);
    setTSDesc(true);
    setUSGDesc(true);
    setOWSDesc(true);
    setDWSDesc(true);
    setWSDesc(true);
    setOBPMDesc(true);
    setDBPMDesc(true);
    setBPMDesc(false);
    setVORPDesc(true);
  };

  useEffect(() => {
    getPlayers(season);
  }, [season]);

  const getPlayers = (year) => {
    Axios.get(`http://localhost:3001/${tableName}/${year}`).then((response) => {
      setPlayersList(response.data);
    });
  };

  const sortColumn = (columnName) => {
    let order = "DESC";

    if (columnName === "Name") {
      if (!NameDesc) order = "ASC";
      setNameDesc(!NameDesc);
    } else if (columnName === "Pos") {
      if (!PosDesc) order = "ASC";
      setPosDesc(!PosDesc);
    } else if (columnName === "Age") {
      if (!AgeDesc) order = "ASC";
      setAgeDesc(!AgeDesc);
    } else if (columnName === "Team") {
      if (!TeamDesc) order = "ASC";
      setTeamDesc(!TeamDesc);
    } else if (columnName === "GP") {
      if (!GPDesc) order = "ASC";
      setGPDesc(!GPDesc);
    } else if (columnName === "MP") {
      if (!MPDesc) order = "ASC";
      setMPDesc(!MPDesc);
    } else if (columnName === "PER") {
      if (!PERDesc) order = "ASC";
      setPERDesc(!PERDesc);
    } else if (columnName === "TS") {
      if (!TSDesc) order = "ASC";
      setTSDesc(!TSDesc);
    } else if (columnName === "USG") {
      if (!USGDesc) order = "ASC";
      setUSGDesc(!USGDesc);
    } else if (columnName === "OWS") {
      if (!OWSDesc) order = "ASC";
      setOWSDesc(!OWSDesc);
    } else if (columnName === "DWS") {
      if (!DWSDesc) order = "ASC";
      setDWSDesc(!DWSDesc);
    } else if (columnName === "WS") {
      if (!WSDesc) order = "ASC";
      setWSDesc(!WSDesc);
    } else if (columnName === "OBPM") {
      if (!OBPMDesc) order = "ASC";
      setOBPMDesc(!OBPMDesc);
    } else if (columnName === "DBPM") {
      if (!DBPMDesc) order = "ASC";
      setDBPMDesc(!DBPMDesc);
    } else if (columnName === "BPM") {
      if (BPMDesc) order = "ASC";
      setBPMDesc(!BPMDesc);
    } else if (columnName === "VORP") {
      if (!VORPDesc) order = "ASC";
      setVORPDesc(!VORPDesc);
    }

    Axios.get(
      `http://localhost:3001/sort/${tableName}/${columnName}/${order}/${season}`
    ).then((response) => {
      setPlayersList(response.data);
    });
  };

  return (
    <Wrapper>
      <div className="advStatsContainer">
        <div className="selectContainer">
          <select value={season} onChange={seasonChangeHandler}>
            {seasons.map((seasons) => (
              <option key={seasons.value} value={seasons.value}>
                {seasons.text}
              </option>
            ))}
          </select>
        </div>
        <TableWrapper>
          <tbody>
            <tr className="headerRow">
              <th></th>
              <th className="headerRowName" onClick={() => sortColumn("Name")}>
                Name
              </th>
              <th onClick={() => sortColumn("Pos")}>Pos</th>
              <th onClick={() => sortColumn("Age")}>Age</th>
              <th onClick={() => sortColumn("Team")}>Team</th>
              <th onClick={() => sortColumn("GP")}>GP</th>
              <th onClick={() => sortColumn("MP")}>MP</th>
              <th onClick={() => sortColumn("PER")}>PER</th>
              <th onClick={() => sortColumn("TS")}>TS%</th>
              <th onClick={() => sortColumn("USG")}>USG%</th>
              <th onClick={() => sortColumn("OWS")}>OWS</th>
              <th onClick={() => sortColumn("DWS")}>DWS</th>
              <th onClick={() => sortColumn("WS")}>WS</th>
              <th onClick={() => sortColumn("OBPM")}>O+/-</th>
              <th onClick={() => sortColumn("DBPM")}>D+/-</th>
              <th onClick={() => sortColumn("BPM")}>+/-</th>
              <th onClick={() => sortColumn("VORP")}>VORP</th>
            </tr>
            {playersList.map((val, key) => {
              return (
                <tr key={key + 1}>
                  <td className="colCentered colDarker">{key + 1}</td>
                  <td className="colName">
                    <Overlay props={val} />
                  </td>
                  <td className="colCentered colDarker">{val.Pos}</td>
                  <td className="colCentered">{val.Age}</td>
                  <td className="colCentered colDarker">{val.Team}</td>
                  <td>{val.GP}</td>
                  <td className="colDarker">{val.MP}</td>
                  <td>{val.PER}</td>
                  <td className="colDarker">{val.TS}</td>
                  <td>{val.USG}</td>
                  <td className="colDarker">{val.OWS}</td>
                  <td>{val.DWS}</td>
                  <td className="colDarker">{val.WS}</td>
                  <td>{val.OBPM}</td>
                  <td className="colDarker">{val.DBPM}</td>
                  <td>{val.BPM}</td>
                  <td className="colDarker">{val.VORP}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      </div>
    </Wrapper>
  );
};

export default AdvancedStats;
