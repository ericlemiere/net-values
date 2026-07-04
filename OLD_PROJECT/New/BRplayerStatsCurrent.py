import sqlite3
import requests
from bs4 import BeautifulSoup
from NormalizeNameModule import NormalizeName

def PlayerStatsCurrent():
    conn = sqlite3.connect('Databases/Main.db')

    year = 2023

    url = "https://www.basketball-reference.com/leagues/NBA_{}_per_game.html".format(year)
    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')

    rows = soup.find_all("tr")
    rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]


    newTable = "PlayerStats_{0}_{1}".format(year-1, year)

    sqlDropTable = "DROP TABLE IF EXISTS `{}`".format(newTable)

    sqlNewTable = """ CREATE TABLE IF NOT EXISTS `{}` (
        Pk int PRIMARY KEY,
        Name varchar(50),
        Pos varchar(4),
        Age int,
        Team varchar(3),
        GP int,
        GS int,
        MPG decimal(3,1),
        FGM decimal(3,1),
        FGA decimal(3,1),
        FGP decimal(3,1),
        [3PM] decimal(3,1),
        [3PA] decimal(3,1),
        [3PP] decimal(3,1),
        [2PM] decimal(3,1),
        [2PA] decimal(3,1),
        [2PP] decimal(3,1),
        eFG decimal(3,1),
        FTM decimal(3,1),
        FTA decimal(3,1),
        FTP decimal(3,1),
        ORB decimal(3,1),
        DRB decimal(3,1),
        REB decimal(3,1),
        AST decimal(3,1),
        STL decimal(3,1),
        BLK decimal(3,1),
        TOV decimal(3,1),
        PF decimal(3,1),
        PTS decimal(3,1)
    ) """.format(newTable)

    cursor = conn.cursor()
    cursor.execute(sqlDropTable)
    cursor.execute(sqlNewTable)

    def convertToInt(data):
        if len(data) > 0:
            return(int(data))
        else:
            return(0)

    def convertToFloat(data, percentage):
        if len(data) > 0:
            if percentage == True:
                dataPerc = float(data) * 100
                return(round(dataPerc, 1))
            else:
                return(round(float(data), 1))
        else:
            return(0.0)


    pk = 1
    for row in rowData:
        if len(row) > 0 :
            Pk = pk
            Name = NormalizeName(row[0])
            Position = row[1]
            Age = convertToInt(row[2])
            Team = row[3]
            GamesPlayed = convertToInt(row[4])
            GamesStarted = convertToInt(row[5])
            MinutesPlayed = convertToFloat(row[6], False)
            fgm = convertToFloat(row[7], False)
            fga = convertToFloat(row[8], False)
            fgp = convertToFloat(row[9], True)
            thpm = convertToFloat(row[10], False)
            thpa = convertToFloat(row[11], False)
            thpp = convertToFloat(row[12], True)
            twpm = convertToFloat(row[13], False)
            twpa = convertToFloat(row[14], False)
            twpp = convertToFloat(row[15], True)
            efg = convertToFloat(row[16], True)
            ftm = convertToFloat(row[17], False)
            fta = convertToFloat(row[18], False)
            ftp = convertToFloat(row[19], True)
            orb = convertToFloat(row[20], False)
            drb = convertToFloat(row[21], False)
            reb = convertToFloat(row[22], False)
            ast = convertToFloat(row[23], False)
            stl = convertToFloat(row[24], False)
            blk = convertToFloat(row[25], False)
            tov = convertToFloat(row[26], False)
            pf = convertToFloat(row[27], False)
            pts = convertToFloat(row[28], False)
            
            sqlInsert = """ INSERT INTO `{}` VALUES (
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?) """.format(newTable)

            conn = sqlite3.connect('Databases/Main.db')
            cursor = conn.cursor()
            with conn:
                cursor.execute(sqlInsert,
                            [Pk, 
                            Name, 
                            Position, 
                            Age, 
                            Team, 
                            GamesPlayed, 
                            GamesStarted,
                            MinutesPlayed, 
                            fgm,
                            fga,
                            fgp,
                            thpm,
                            thpa,
                            thpp,
                            twpm,
                            twpa,
                            twpp,
                            efg,
                            ftm,
                            fta,
                            ftp,
                            orb,
                            drb,
                            reb,
                            ast,
                            stl,
                            blk,
                            tov,
                            pf,
                            pts          
                            ])
                conn.commit()

            pk += 1

    print(newTable)
        


