import sqlite3
import requests
from bs4 import BeautifulSoup

conn = sqlite3.connect('Databases/Team-Payrolls-Hoopshype.db')


def TeamAbbreviation(teamName):
    if teamName.lower() == "atlanta":
        return("ATL")
    if teamName.lower() == "boston":
        return("BOS")
    if teamName.lower() == "brooklyn":
        if year <= 2012:
            return("NJN")
        else:
            return("BRK")
    if teamName.lower() == "charlotte":
        if year <= 2002:
            return("CHH")
        if year >= 2015:
            return("CHO")
        else:
            return("CHA")
    if teamName.lower() == "new orleans":
        if year == 2003 or year == 2004 or year == 2005:
            return("NOH")
        if year == 2006 or year == 2007:
            return("NOK")
        else:
            return("NOP")
    if teamName.lower() == "chicago":
        return("CHI")
    if teamName.lower() == "cleveland":
        return("CLE")
    if teamName.lower() == "dallas":
        return("DAL")
    if teamName.lower() == "denver":
        return("DEN")
    if teamName.lower() == "detroit":
        return("DET")
    if teamName.lower() == "golden state":
        return("GSW")
    if teamName.lower() == "houston":
        return("HOU")
    if teamName.lower() == "indiana":
        return("IND")
    if teamName == "LA Clippers":
        return("LAC")
    if teamName == "LA Lakers":
        return("LAL")
    if teamName.lower() == "memphis":
        if year <= 2001:
            return("VAN")
        else:
            return("MEM")
    if teamName.lower() == "miami":
        return("MIA")
    if teamName.lower() == "milwaukee":
        return("MIL")
    if teamName.lower() == "minnesota":
        return("MIN")
    if teamName.lower() == "new york":
        return("NYK")
    if teamName.lower() == "oklahoma city":
        if year <= 2008:
            return("SEA")
        else:
            return("OKC")
    if teamName.lower() == "orlando":
        return("ORL")
    if teamName.lower() == "philadelphia":
        return("PHI")
    if teamName.lower() == "phoenix":
        return("PHX")
    if teamName.lower() == "portland":
        return("POR")
    if teamName.lower() == "sacramento":
        return("SAC")
    if teamName.lower() == "san antonio":
        return("SAS")
    if teamName.lower() == "toronto":
        return("TOR")
    if teamName.lower() == "utah":
        return("UTA")
    if teamName.lower() == "washington":
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

while year > 1990:
    yearString = "{0}-{1}".format(year-1, year)
    sqlYearString = yearString.replace("-", "_")

    if year == 2023: url = "https://hoopshype.com/salaries/"
    else: url = "https://hoopshype.com/salaries/{}/".format(yearString)

    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')
    rows = soup.find_all("tr")
    rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]


    newTable = "Season_{0}".format(sqlYearString)

    sqlNewTable = """ 
    CREATE TABLE IF NOT EXISTS {} (
    Pk int PRIMARY KEY,
    Team varchar(3),
    Payroll int,
    SeasonCap int
    ) """.format(newTable)

    conn = sqlite3.connect('Databases/Team-Payrolls-Hoopshype.db')
    cursor = conn.cursor()
    with conn:
        cursor.execute(sqlNewTable)
        conn.commit()
    
    seasonCap = CapHistory(yearString)
    

    for row in rowData[1:]:
        pk = int(row[0].strip().replace(".", ""))
        teamName = TeamAbbreviation(row[1].strip())
        payroll = int(row[2].strip().strip("$").replace(",", ""))

        sqlInsert = """ 
        INSERT INTO {0} VALUES (?,?,?,?)
        """.format(newTable)


        conn = sqlite3.connect('Databases/Team-Payrolls-Hoopshype.db')
        cursor = conn.cursor()
        with conn:
            cursor.execute(sqlInsert, [pk, teamName, payroll, seasonCap])
            conn.commit()

        
    print(yearString)
    year -= 1


