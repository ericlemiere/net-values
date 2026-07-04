import sqlite3
import requests
from bs4 import BeautifulSoup


def TeamAbbreviation(teamName):
    if teamName.lower() == "atlanta hawks":
        return("ATL")
    if teamName.lower() == "boston celtics":
        return("BOS")
    if teamName.lower() == "brooklyn nets":
        return("BRK")
    if teamName.lower() == "new jersey nets":
        return("NJN")
    if teamName.lower() == "charlotte hornets":
        return("CHO")
    if teamName.lower() == "charlotte bobcats":
        return("CHA")
    if teamName.lower() == "new orleans pelicans":
        return("NOP")
    if teamName.lower() == "new orleans hornets":
        return("NOH")
    if teamName.lower() == "chicago bulls":
        return("CHI")
    if teamName.lower() == "cleveland cavaliers":
        return("CLE")
    if teamName.lower() == "dallas mavericks":
        return("DAL")
    if teamName.lower() == "denver nuggets":
        return("DEN")
    if teamName.lower() == "detroit pistons":
        return("DET")
    if teamName.lower() == "golden state warriors":
        return("GSW")
    if teamName.lower() == "houston rockets":
        return("HOU")
    if teamName.lower() == "indiana pacers":
        return("IND")
    if teamName == "Los Angeles Clippers":
        return("LAC")
    if teamName == "Los Angeles Lakers":
        return("LAL")
    if teamName.lower() == "memphis grizzlies":
        return("MEM")
    if teamName.lower() == "miami heat":
        return("MIA")
    if teamName.lower() == "milwaukee bucks":
        return("MIL")
    if teamName.lower() == "minnesota timberwolves":
        return("MIN")
    if teamName.lower() == "new york knicks":
        return("NYK")
    if teamName.lower() == "oklahoma city thunder":
        return("OKC")
    if teamName.lower() == "orlando magic":
        return("ORL")
    if teamName.lower() == "philadelphia 76ers":
        return("PHI")
    if teamName.lower() == "phoenix suns":
        return("PHX")
    if teamName.lower() == "portland trail blazers":
        return("POR")
    if teamName.lower() == "sacramento kings":
        return("SAC")
    if teamName.lower() == "san antonio spurs":
        return("SAS")
    if teamName.lower() == "toronto raptors":
        return("TOR")
    if teamName.lower() == "utah jazz":
        return("UTA")
    if teamName.lower() == "washington wizards":
        return("WAS")

def CapHistory(seasonCap):
    if seasonCap == "1990-1991": return(11871000)
    if seasonCap == "1991-1992": return(12500000)
    if seasonCap == "1992-1993": return(14000000)
    if seasonCap == "1993-1994": return(15175000)
    if seasonCap == "1994-1995": return(15964000)
    if seasonCap == "1995-1996": return(23000000)
    if seasonCap == "1996-1997": return(24363000)
    if seasonCap == "1997-1998": return(26900000)
    if seasonCap == "1998-1999": return(30000000)
    if seasonCap == "1999-2000": return(34000000)
    if seasonCap == "2000-2001": return(35500000)
    if seasonCap == "2001-2002": return(42500000)
    if seasonCap == "2002-2003": return(40271000)
    if seasonCap == "2003-2004": return(43840000)
    if seasonCap == "2004-2005": return(43870000)
    if seasonCap == "2005-2006": return(49500000)
    if seasonCap == "2006-2007": return(53135000)
    if seasonCap == "2007-2008": return(55630000)
    if seasonCap == "2008-2009": return(58680000)
    if seasonCap == "2009-2010": return(57700000)
    if seasonCap == "2010-2011": return(58044000)
    if seasonCap == "2011-2012": return(58044000)
    if seasonCap == "2012-2013": return(58044000)
    if seasonCap == "2013-2014": return(58679000)
    if seasonCap == "2014-2015": return(63065000)
    if seasonCap == "2015-2016": return(70000000)
    if seasonCap == "2016-2017": return(94143000)
    if seasonCap == "2017-2018": return(99093000)
    if seasonCap == "2018-2019": return(101869000)
    if seasonCap == "2019-2020": return(109140000)
    if seasonCap == "2020-2021": return(109140000)
    if seasonCap == "2021-2022": return(112414000)
    if seasonCap == "2022-2023": return(123655000)

year = 2023

while year >= 2012:
    yearString = "{0}-{1}".format(year, year+1)
    sqlYearString = yearString.replace("-", "_")

    fileString = "New/SpotracTeamCap/cap-{}.html".format(year)
    HTMLFileToBeOpened = open(fileString, "r")
    
    contents = HTMLFileToBeOpened.read()

    soup = BeautifulSoup(contents, 'html.parser')
    rows = soup.find_all("tr")
    rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]
    teams = soup.find_all("span", class_="xs-hide")

    teamList = []
    for team in teams:
        teamList.append(team.text)
    
    activeCapList = []
    totalCapList = []
    for row in rowData:
        if year == 2023:
            activeCapList.append(row[4].strip().strip("$").replace(",", ""))
            totalCapList.append(row[7].strip().strip("$").replace(",", ""))
        else:
            activeCapList.append(row[5].strip().strip("$").replace(",", ""))
            totalCapList.append(row[8].strip().strip("$").replace(",", ""))

    

    newTable = "TeamCaps_{0}".format(sqlYearString)
    sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)

    sqlNewTable = """ 
    CREATE TABLE IF NOT EXISTS {} (
    Pk int PRIMARY KEY,
    Team varchar(3),
    ActiveCap int,
    TotalCap int,
    SeasonCap int
    ) """.format(newTable)

    conn = sqlite3.connect('Databases/Main.db')
    cursor = conn.cursor()
    with conn:
        cursor.execute(sqlDropTable)
        cursor.execute(sqlNewTable)
        conn.commit()
    
    seasonCap = CapHistory(yearString)

    i = 0
    pk = 1
    while i < len(teamList):
        teamName = TeamAbbreviation(teamList[i])
        activeCap = int(activeCapList[i])
        teamCap = int(totalCapList[i])
        
        sqlInsert = """ 
        INSERT INTO {0} VALUES (?,?,?,?,?)
        """.format(newTable)

        conn = sqlite3.connect('Databases/Main.db')
        cursor = conn.cursor()
        with conn:
            cursor.execute(sqlInsert, [pk, teamName, activeCap, teamCap, seasonCap])
            conn.commit()
        pk += 1
        i += 1

    print(newTable)
    year -= 1
    