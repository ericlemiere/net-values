import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Main.db')
year = 2023

while year >= 2012:
    yearString = "{0}-{1}".format(year-1, year)
    sqlYearString = yearString.replace("-", "_")

    fileString = "New/SpotracPlayerSalaries/sal-{}.html".format(year)
    HTMLFileToBeOpened = open(fileString, "r")
    contents = HTMLFileToBeOpened.read()
    soup = BeautifulSoup(contents, 'html.parser')
    baseRows = soup.find_all("tr")
    baseRowData = [[td.getText() for td in baseRows[i].findAll('td')] for i in range(len(baseRows))]
    baseNames = [[h.getText() for h in baseRows[i].findAll('h3')] for i in range(len(baseRows))]

    baseTeam = soup.find_all("div", class_="rank-position")


    newTable = "SalariesCapHitsSPO_{}".format(sqlYearString)

    sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)

    sqlNewTable = """ CREATE TABLE IF NOT EXISTS {} (
        Pk int PRIMARY KEY,
        Name varchar(50),
        Team varchar(3),
        Base int,
        CapHit int
    ) """.format(newTable)

    cursor = conn.cursor()
    with conn:
        cursor.execute(sqlDropTable)
        cursor.execute(sqlNewTable)
        conn.commit()

    i = 0
    pk = 1
    while i < len(baseRowData):
        name = baseNames[i][0].strip()
        base = int(baseRowData[i][4].strip().strip("$").replace(",", ""))
        team = baseTeam[i].getText().strip()

        sqlInsert = """ INSERT INTO {} VALUES (?,?,?,?,NULL) """.format(newTable)

        conn = sqlite3.connect('Databases/Main.db')
        cursor = conn.cursor()
        with conn:
            cursor.execute(sqlInsert, [pk, name, team, base])
            conn.commit()

        pk += 1
        i += 1

    print(yearString)
    year -= 1


