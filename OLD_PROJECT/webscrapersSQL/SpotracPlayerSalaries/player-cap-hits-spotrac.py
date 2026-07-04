import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Main.db')
year = 2023

while year >= 2012:
    yearString = "{0}-{1}".format(year-1, year)
    sqlYearString = yearString.replace("-", "_")

    caphitString = "New/SpotracPlayerSalaries/cap-{}.html".format(year)
    HTMLCapFile = open(caphitString, "r")
    capContents = HTMLCapFile.read()
    bs = BeautifulSoup(capContents, 'html.parser')
    capRows = bs.find_all("tr")
    capRowData = [[td.getText() for td in capRows[i].findAll('td')] for i in range(len(capRows))]
    capNames = [[h.getText() for h in capRows[i].findAll('h3')] for i in range(len(capRows))]


    newTable = "SalariesCapHitsSPO_{}".format(sqlYearString)


    i = 0
    pk = 1
    while i < len(capRowData):
        name = capNames[i][0].strip()
        capHit = int(capRowData[i][4].strip().strip("$").replace(",", ""))

        
        sqlInsert = """ 
        UPDATE {0} 
        SET CapHit = {1} 
        WHERE Name = "{2}"
        """.format(newTable, capHit, name)

        conn = sqlite3.connect('Databases/Main.db')
        cursor = conn.cursor()
        with conn:
            cursor.execute(sqlInsert)
            conn.commit()

        pk += 1
        i += 1

    print(yearString)
    year -= 1


