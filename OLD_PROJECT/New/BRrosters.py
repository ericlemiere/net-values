import sqlite3
import requests
from bs4 import BeautifulSoup
from NormalizeNameModule import NormalizeName

def Rosters():
    conn = sqlite3.connect('Databases/Main.db')
    cursor = conn.cursor()

    year = 2015

    teamList = [
        'ATL', 'BOS', 'BRK', 'CHA', 'CHH', 'CHI', 'CHO', 'CLE', 'DAL', 'DEN',
        'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 
        'NJN', 'NOH', 'NOK', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 
        'SAC', 'SAS', 'SEA', 'TOR', 'UTA', 'VAN', 'WAS'
    ]


    while year >= 1990:

        newTable = "Rosters_{0}_{1}".format(year-1, year)
        sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)
        sqlCreateTable = """ 
        CREATE TABLE IF NOT EXISTS {} (
        Pk int PRIMARY KEY,
        Team varchar(3),
        Name varchar(50)
        ) """.format(newTable)

        with conn:
            cursor.execute(sqlDropTable)
            cursor.execute(sqlCreateTable)
            conn.commit()

        pk = 1
        for team in teamList:   
            url = "https://www.basketball-reference.com/teams/{0}/{1}.html".format(team, year)
            page = requests.get(url)
            soup = BeautifulSoup(page.content, 'html.parser')

            divID = soup.find(id="roster")

            if divID is not None:
                rows = divID.find_all('tr')
                rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]

                
                for row in rowData[1:]:
                    nameInit = row[0].strip().replace("\xa0\xa0", "").replace("(TW)", "")
                    name = NormalizeName(nameInit)

                    sqlInsert = """ 
                    INSERT INTO {0} VALUES (?,?,?)
                    """.format(newTable)

                    with conn:
                        cursor.execute(sqlInsert, [pk, team, name])
                        conn.commit()

                    pk += 1      
        print(newTable)
        year -= 1