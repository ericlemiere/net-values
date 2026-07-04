import sqlite3
import requests
from bs4 import BeautifulSoup
from NormalizeNameModule import NormalizeName


def AdvancedStats():
    conn = sqlite3.connect('Databases/Main.db')

    year = 2022

    while year >= 1990:
        url = "https://www.basketball-reference.com/leagues/NBA_{}_advanced.html".format(year)
        page = requests.get(url)
        soup = BeautifulSoup(page.content, 'html.parser')

        rows = soup.find_all("tr")
        rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]


        newTable = "AdvancedStats_{0}_{1}".format(year-1, year)
        sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)

        sqlNewTable = """ CREATE TABLE IF NOT EXISTS {} (
            Pk int PRIMARY KEY,
            Name varchar(50),
            Pos varchar(4),
            Age int,
            Team varchar(3),
            GP int,
            MP int,
            PER decimal(3, 1),
            TS decimal(4, 1),
            USG decimal(3, 1),
            OWS decimal(3, 1),
            DWS decimal(3, 1),
            WS decimal(3, 1),
            OBPM decimal(3, 1),
            DBPM decimal(3, 1),
            BPM decimal(3, 1),
            VORP decimal(3, 1)
        ) """.format(newTable)

        cursor = conn.cursor()
        cursor.execute(sqlDropTable)
        cursor.execute(sqlNewTable)


        pk = 1
        for row in rowData:
            if len(row) > 0 and len(row[7]) > 0 :
                Pk = pk
                Name = NormalizeName(row[0])
                Position = row[1]
                Age = int(row[2])
                Team = row[3]
                GamesPlayed = int(row[4])
                MinutesPlayed = int(row[5])
                PlayerEfficiencyRating = float(row[6])
                trueShooting = round(float(row[7]) * 100, 1)
                usagePercentage = round(float(row[17]), 1)
                offensiveWinShares = round(float(row[19]), 1)
                defensiveWinShares = round(float(row[20]), 1)
                winShares = round(float(row[21]), 1)
                offensiveBoxPlusMinus = round(float(row[24]), 1)
                defensiveBoxPlusMinus = round(float(row[25]), 1)
                boxPlusMinus = round(float(row[26]), 1)
                valueOverReplacementPlayer = round(float(row[27]), 1)

                
                # [0] Name
                # [1] Position
                # [2] Age
                # [3] Team
                # [4] GamesPlayed
                # [5] MinutesPlayed
                # [6] PER
                # [7] TrueShooting
                # [17] UsagePercentage
                # [19] OffensiveWinShares
                # [20] DefensiveWinShares
                # [21] WinShares
                # [24] OffensiveBoxPlusMinus
                # [25] DefensiveBoxPlusMinus
                # [26] BoxPlusMinus
                # [27] ValueOverReplacementPlayer        
                

                sqlInsert = """ INSERT INTO {} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) """.format(newTable)

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
                                MinutesPlayed, 
                                PlayerEfficiencyRating,
                                trueShooting,
                                usagePercentage, 
                                offensiveWinShares,
                                defensiveWinShares,
                                winShares,
                                offensiveBoxPlusMinus,
                                defensiveBoxPlusMinus,
                                boxPlusMinus,
                                valueOverReplacementPlayer
                                ])
                    conn.commit()

                pk += 1

        year -= 1
        print(newTable)
            


        



