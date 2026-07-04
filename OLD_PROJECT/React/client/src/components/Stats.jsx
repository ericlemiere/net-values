import React, { useEffect, useState } from "react";
import Axios from "axios";
import './Stats.css';
import TableWrapper from "./TableWrapper/TableWrapper";
import Wrapper from "./Wrapper/Wrapper";
import Overlay from "./Modal/Overlay";

const Stats = () => {
  const tableName = "PlayerStats";
  const [playersList, setPlayersList] = useState([]);
  const [NameDesc, setNameDesc] = useState(false);
  const [PosDesc, setPosDesc] = useState(false);
  const [AgeDesc, setAgeDesc] = useState(true);
  const [TeamDesc, setTeamDesc] = useState(false);
  const [GPDesc, setGPDesc] = useState(true);
  const [GSDesc, setGSDesc] = useState(true);
  const [MPGDesc, setMPGDesc] = useState(true);
  const [FGMdesc, setFGMdesc] = useState(true);
  const [FGAdesc, setFGAdesc] = useState(true);
  const [FGPdesc, setFGPdesc] = useState(true);
  const [thPMdesc, setthPMdesc] = useState(true);
  const [thPAdesc, setthPAdesc] = useState(true);
  const [thPPdesc, setthPPdesc] = useState(true);
  const [twPMdesc, settwPMdesc] = useState(true);
  const [twPAdesc, settwPAdesc] = useState(true);
  const [twPPdesc, settwPPdesc] = useState(true);
  const [eFGdesc, seteFGdesc] = useState(true);
  const [FTMdesc, setFTMdesc] = useState(true);
  const [FTAdesc, setFTAdesc] = useState(true);
  const [FTPdesc, setFTPdesc] = useState(true);
  const [ORBdesc, setORBdesc] = useState(true);
  const [DRBdesc, setDRBdesc] = useState(true);
  const [REBdesc, setREBdesc] = useState(true);
  const [ASTdesc, setASTdesc] = useState(true);
  const [STLdesc, setSTLdesc] = useState(true);
  const [BLKdesc, setBLKdesc] = useState(true);
  const [TOVdesc, setTOVdesc] = useState(true);
  const [PFdesc, setPFdesc] = useState(true);
  const [PTSdesc, setPTSdesc] = useState(true);

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
    setGSDesc(true);
    setMPGDesc(true);
    setFGMdesc(true);
    setFGAdesc(true);
    setFGPdesc(true);
    setthPAdesc(true);
    setthPMdesc(true);
    setthPPdesc(true);
    settwPAdesc(true);
    settwPMdesc(true);
    settwPPdesc(true);
    seteFGdesc(true);
    setFTAdesc(true);
    setFTMdesc(true);
    setFTPdesc(true);
    setORBdesc(true);
    setDRBdesc(true);
    setREBdesc(true);
    setASTdesc(true);
    setSTLdesc(true);
    setBLKdesc(true);
    setTOVdesc(true);
    setPFdesc(true);
    setPTSdesc(true);
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
    } else if (columnName === "GS") {
      if (!GSDesc) order = "ASC";
      setGSDesc(!GSDesc);
    } else if (columnName === "MPG") {
      if (!MPGDesc) order = "ASC";
      setMPGDesc(!MPGDesc);
    } else if (columnName === "FGM") {
      if (!FGMdesc) order = "ASC";
      setFGMdesc(!FGMdesc);
    }  else if (columnName === "FGA") {
      if (!FGAdesc) order = "ASC";
      setFGAdesc(!FGAdesc);
    } else if (columnName === "FGP") {
      if (!FGPdesc) order = "ASC";
      setFGPdesc(!FGPdesc);
    } else if (columnName === "thPM") {
      if (!thPMdesc) order = "ASC";
      setthPMdesc(!thPMdesc);
    }  else if (columnName === "thPA") {
      if (!thPAdesc) order = "ASC";
      setthPAdesc(!thPAdesc);
    } else if (columnName === "thPP") {
      if (!thPPdesc) order = "ASC";
      setthPPdesc(!thPPdesc);
    } else if (columnName === "twPM") {
      if (!twPMdesc) order = "ASC";
      settwPMdesc(!twPMdesc);
    }  else if (columnName === "thPA") {
      if (!twPAdesc) order = "ASC";
      settwPAdesc(!twPAdesc);
    } else if (columnName === "twPP") {
      if (!twPPdesc) order = "ASC";
      settwPPdesc(!twPPdesc);
    } else if (columnName === "FTM") {
      if (!FTMdesc) order = "ASC";
      setFTMdesc(!FTMdesc);
    }  else if (columnName === "FTA") {
      if (!FTAdesc) order = "ASC";
      setFTAdesc(!FTAdesc);
    } else if (columnName === "FTP") {
      if (!FTPdesc) order = "ASC";
      setFTPdesc(!FTPdesc);
    } else if (columnName === "eFG") {
      if (!eFGdesc) order = "eFG";
      seteFGdesc(!eFGdesc);
    } else if (columnName === "ORB") {
      if (!ORBdesc) order = "ASC";
      setORBdesc(!ORBdesc);
    } else if (columnName === "DRB") {
      if (!DRBdesc) order = "ASC";
      setDRBdesc(!DRBdesc);
    } else if (columnName === "REB") {
      if (!REBdesc) order = "ASC";
      setREBdesc(!REBdesc);
    } else if (columnName === "AST") {
      if (!ASTdesc) order = "ASC";
      setASTdesc(!ASTdesc);
    } else if (columnName === "STL") {
      if (!STLdesc) order = "ASC";
      setSTLdesc(!STLdesc);
    } else if (columnName === "BLK") {
      if (!BLKdesc) order = "ASC";
      setBLKdesc(!BLKdesc);
    } else if (columnName === "TOV") {
      if (!TOVdesc) order = "ASC";
      setTOVdesc(!TOVdesc);
    } else if (columnName === "PF") {
      if (!PFdesc) order = "ASC";
      setPFdesc(!PFdesc);
    } else if (columnName === "PTS") {
      if (!PTSdesc) order = "ASC";
      setPTSdesc(!PTSdesc);
    }
    

    Axios.get(
      `http://localhost:3001/sort/${tableName}/${columnName}/${order}/${season}`
    ).then((response) => {
      setPlayersList(response.data);
    });
  };

  return (
    <Wrapper>
      <div className="stats">
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
              <th onClick={() => sortColumn("GS")}>GS</th>
              <th onClick={() => sortColumn("MPG")}>MPG</th>
              <th onClick={() => sortColumn("FGM")}>FGM</th>
              <th onClick={() => sortColumn("FGA")}>FGA</th>
              <th onClick={() => sortColumn("FGP")}>FG%</th>
              <th onClick={() => sortColumn("thPM")}>3PM</th>
              <th onClick={() => sortColumn("thPA")}>3PA</th>
              <th onClick={() => sortColumn("thPP")}>3P%</th>
              <th onClick={() => sortColumn("twPM")}>2PM</th>
              <th onClick={() => sortColumn("twPA")}>2PA</th>
              <th onClick={() => sortColumn("twPP")}>2P%</th>
              <th onClick={() => sortColumn("eFG")}>eFG%</th>
              <th onClick={() => sortColumn("FTM")}>FTM</th>
              <th onClick={() => sortColumn("FTA")}>FTA</th>
              <th onClick={() => sortColumn("FTP")}>FT%</th>
              <th onClick={() => sortColumn("ORB")}>OREB</th>
              <th onClick={() => sortColumn("DRB")}>DREB</th>
              <th onClick={() => sortColumn("REB")}>REB</th>
              <th onClick={() => sortColumn("AST")}>AST</th>
              <th onClick={() => sortColumn("STL")}>STL</th>
              <th onClick={() => sortColumn("BLK")}>BLK</th>
              <th onClick={() => sortColumn("TOV")}>TOV</th>
              <th onClick={() => sortColumn("PF")}>PF</th>
              <th onClick={() => sortColumn("PTS")}>PTS</th>
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
                  <td className="colDarker">{val.GS}</td>
                  <td>{val.MPG}</td>
                  <td className="colDarker">{val.FGM}</td>
                  <td>{val.FGA}</td>
                  <td className="colDarker">{val.FGP}</td>
                  <td>{val.thPM}</td>
                  <td className="colDarker">{val.thPA}</td>
                  <td>{val.thPP}</td>
                  <td className="colDarker">{val.twPM}</td>
                  <td>{val.twPA}</td>
                  <td className="colDarker">{val.twPP}</td>
                  <td>{val.eFG}</td>
                  <td className="colDarker">{val.FTM}</td>
                  <td>{val.FTA}</td>
                  <td className="colDarker">{val.FTP}</td>
                  <td>{val.ORB}</td>
                  <td className="colDarker">{val.DRB}</td>
                  <td>{val.REB}</td>
                  <td className="colDarker">{val.AST}</td>
                  <td>{val.STL}</td>
                  <td className="colDarker">{val.BLK}</td>
                  <td>{val.TOV}</td>
                  <td className="colDarker">{val.PF}</td>
                  <td>{val.PTS}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      </div>
    </Wrapper>
  );
};

export default Stats;
