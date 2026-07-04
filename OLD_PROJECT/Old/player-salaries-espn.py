import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Player-Salaries-By-Year.db')

pageNumber = 1
pageNumberMax = 15
year = 2023
yearLast = 2000

def TeamAbbreviation(teamName):
    if teamName.lower() == "atlanta hawks":
        return("ATL")
    if teamName.lower() == "boston celtics":
        return("BOS")
    if teamName.lower() == "brooklyn nets":
        return("BRK")
    if teamName.lower() == "charlotte hornets":
        if year > 2005:
            return("CHO")
        else:
            return("CHH")
    if teamName.lower() == "charlotte bobcats":
        return("CHA")
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
    if teamName == "LA Clippers":
        return("LAC")
    if teamName.lower() == "los angeles lakers":
        return("LAL")
    if teamName.lower() == "memphis grizzlies":
        return("MEM")
    if teamName.lower() == "vancouver grizzlies":
        return("VAN")
    if teamName.lower() == "miami heat":
        return("MIA")
    if teamName.lower() == "milwaukee bucks":
        return("MIL")
    if teamName.lower() == "minnesota timberwolves":
        return("MIN")
    if teamName.lower() == "new jersey nets":
        return("NJN")
    if teamName.lower() == "new orleans pelicans":
        return("NOP")
    if teamName.lower() == "new orleans hornets":
        return("NOH")
    if teamName == "NO/Oklahoma City Hornets":
        return("NOK")
    if teamName.lower() == "new york knicks":
        return("NYK")
    if teamName.lower() == "oklahoma city thunder":
        return("OKC")
    if teamName.lower() == "seattle supersonics":
        return("SEA")
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


while year >= yearLast: 

    newTable = "{0}_{1}".format(year-1, year)   

    sqlNewTable = """ CREATE TABLE IF NOT EXISTS `{}` (
        Pk int PRIMARY KEY,
        Name varchar(50),
        Pos varchar(3),
        TeamName varchar(40),
        Team varchar(3),
        Salary int
    ) """.format(newTable) 

    conn = sqlite3.connect('Databases/Player-Salaries-By-Year.db')
    cursor = conn.cursor()
    with conn:
        cursor.execute(sqlNewTable)
        conn.commit()

    while pageNumber <= pageNumberMax:
    
        url = "http://www.espn.com/nba/salaries/_/year/{0}/page/{1}".format(year, pageNumber)
        page = requests.get(url)
        soup = BeautifulSoup(page.content, 'html.parser')
        rows = soup.find_all("tr")
        rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]

        for row in rowData:
            if row[0] != 'RK':
                Pk = int(row[0])
                namePos = row[1].split(", ")
                Name = namePos[0]
                Pos = namePos[1]
                TeamName = row[2].replace("\r\n", "")
                if TeamName.lower() == "los angeles clippers":
                    TeamName = "LA Clippers"
                Team = TeamAbbreviation(TeamName)
                Salary = int(row[3].strip().strip("$").replace(",", ""))

            
                sqlInsert = """ INSERT INTO `{}` VALUES (?,?,?,?,?,?) """.format(newTable)
                
                conn = sqlite3.connect('Databases/Player-Salaries-By-Year.db')
                cursor = conn.cursor()
                with conn:
                    cursor.execute(sqlInsert, 
                        [Pk, Name, Pos, TeamName, Team, Salary])
                    conn.commit()

        pageNumber += 1
    print(year)
    year -= 1    
    pageNumber = 1    



