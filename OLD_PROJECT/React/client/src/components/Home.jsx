import React, { useEffect, useState } from "react";
import Axios from "axios";
import "./Home.css";
import Overlay from "./Modal/Overlay";
import Wrapper from "./Wrapper/Wrapper";
import TableWrapper from "./TableWrapper/TableWrapper";
import CurrencyFormat from 'react-currency-format';

const Home = () => {
  const tableName = "HHrostersAndPayroll";
  //const [seasonString, setSeasonString] = useState("2022-2023");
  const [playersList, setPlayersList] = useState([]);
  const [NameDesc, setNameDesc] = useState(false);
  const [TeamDesc, setTeamDesc] = useState(false);
  const [leagueCap, setLeagueCap] = useState(0);

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
    //setSeasonString(`${event.target.value - 1}-${event.target.value}`);
    setSeason(event.target.value);
    getPlayers(season);

    // Reset States for column sorting:
    setNameDesc(false);
    setTeamDesc(false);
  };

  useEffect(() => {
    getPlayers(season);
  }, [season]);

  const getPlayers = (year) => {
    let columnName = "Salary";
    let order = "DESC";
    Axios.get(`http://localhost:3001/sort/${tableName}/${columnName}/${order}/${year}`).then((response) => {
      setPlayersList(response.data);
      setLeagueCap(response.data[0]["LeagueCap"]);
    });
  };

  const sortColumn = (columnName) => {
    let order = "DESC";

    if (columnName === "Name") {
      if (!NameDesc) order = "ASC";
      setNameDesc(!NameDesc);
    } else if (columnName === "Team") {
      if (!TeamDesc) order = "ASC";
      setTeamDesc(!TeamDesc);
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
          <div className="leagueCapContainer">League Salary Cap: <span><CurrencyFormat value={leagueCap} displayType={'text'} thousandSeparator={true} prefix={'$'} /></span> </div>
        </div>
        <TableWrapper>
          <tbody>
            <tr className="headerRow">
              <th></th>
              <th className="headerRowName" onClick={() => sortColumn("Name")}>
                Name
              </th>
              <th onClick={() => sortColumn("Salary")}>Salary</th>
              <th className="thWide" onClick={() => sortColumn("Team")}>Team</th>
              <th onClick={() => sortColumn("TeamPayroll")}>Team Payroll</th>
              <th className="thWide" onClick={() => sortColumn("PercOfTeamPayroll")}>% of<br/>Team<br/>Payroll</th>
              <th className="thWide" onClick={() => sortColumn("PercOfLeagueCap")}>% of<br/>League<br/>Cap</th>
              <th>Net Value</th>
            </tr>
            {playersList.map((val, key) => {
              return (
                <tr key={key + 1}>
                  <td className="colCentered colDarker">{key + 1}</td>
                  <td className="colName">
                    <Overlay props={val} />
                  </td>
                  <td className="colDarker"><CurrencyFormat value={val.Salary} displayType={'text'} thousandSeparator={true} prefix={'$'} /></td>
                  <td className="colCentered ">{val.Team}</td>
                  <td className="colDarker"><CurrencyFormat value={val.TeamPayroll} displayType={'text'} thousandSeparator={true} prefix={'$'} /></td>
                  <td className="colCentered ">{val.PercOfTeamPayroll}</td>
                  <td className="colCentered colDarker">{val.PercOfLeagueCap}</td>
                  <td></td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      </div>
    </Wrapper>
  );
};

export default Home;
