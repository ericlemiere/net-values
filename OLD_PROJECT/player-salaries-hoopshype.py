import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Player-Salaries-Hoopshype.db')

year1 = 2022
year2 = 2023

while year1 >= 1990:
    yearString = "{0}-{1}".format(year1, year2)
    if year2 == 2023: url = "https://hoopshype.com/salaries/players/"
    else: url = "https://hoopshype.com/salaries/players/{}/".format(yearString)
    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')

    rows = soup.find_all("tr")
    rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]


    newTable = "Season_{0}_{1}".format(year1, year2)
    sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)

    sqlNewTable = """ CREATE TABLE IF NOT EXISTS {} (
        Pk int PRIMARY KEY,
        Name varchar(50),
        Salary int
    ) """.format(newTable)

    cursor = conn.cursor()
    cursor.execute(sqlDropTable)
    cursor.execute(sqlNewTable)

    pk = 1
    for row in rowData[1:]:
        Pk = pk
        Name = row[1].strip()
        if Name == "Michael Porter":
            Name = "Michael Porter Jr"
        Salary = int(row[2].strip().strip("$").replace(",", ""))

        sqlInsert = """ INSERT INTO {} VALUES (?,?,?) """.format(newTable)

        conn = sqlite3.connect('Databases/Player-Salaries-Hoopshype.db')
        cursor = conn.cursor()
        with conn:
            cursor.execute(sqlInsert, [Pk, Name, Salary])
            conn.commit()

        pk += 1

    year1 -= 1
    year2 -= 1
    print(yearString)
        