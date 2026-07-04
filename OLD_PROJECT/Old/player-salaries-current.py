import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Player-Salaries.db')
cursor = conn.cursor()
with conn:
    cursor.execute("DROP TABLE PlayerSalaries_2022_2023")
    conn.commit()

url = "https://hoopshype.com/salaries/players/"
page = requests.get(url)
soup = BeautifulSoup(page.content, 'html.parser')

rows = soup.find_all("tr")
rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]


newTable = "PlayerSalaries_2022_2023"
#createNewTable = "CREATE TABLE IF NOT EXISTS " + newTable

sqlNewTable = """ CREATE TABLE IF NOT EXISTS {} (
    Pk int PRIMARY KEY,
    Name varchar(50),
    Salary int
) """.format(newTable)

cursor = conn.cursor()
cursor.execute(sqlNewTable)

pk = 1
for row in rowData[1:]:
    Pk = pk
    Name = row[1].strip()
    Salary = int(row[2].strip().strip("$").replace(",", ""))

    sqlInsert = """ INSERT INTO {} VALUES (?,?,?) """.format(newTable)

    conn = sqlite3.connect('Databases/Player-Salaries.db')
    cursor = conn.cursor()
    with conn:
        cursor.execute(sqlInsert, [Pk, Name, Salary])
        conn.commit()

    pk += 1

    