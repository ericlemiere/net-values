import sqlite3
import requests
from bs4 import BeautifulSoup
from NormalizeNameModule import NormalizeName


teamList = [
    "atlanta_hawks", "boston_celtics", "brooklyn_nets", "charlotte_hornets",
    "chicago_bulls", "cleveland_cavaliers", "dallas_mavericks", "denver_nuggets",
    "detroit_pistons", "golden_state_warriors", "houston_rockets", "indiana_pacers",
    "los_angeles_clippers", "los_angeles_lakers", "memphis_grizzlies", 
    "miami_heat", "milwaukee_bucks", "minnesota_timberwolves", 'new_orleans_pelicans', 
    'new_york_knicks', 'oklahoma_city_thunder', 'orlando_magic', 'philadelphia_76ers',
    'phoenix_suns', 'portland_trail_blazers', 'sacramento_kings', 'san_antonio_spurs', 
    'toronto_raptors', 'utah_jazz', 'washington_wizards'
]

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

def TeamAbbreviation(teamName):
    if 'hawks' in teamName:
        return("ATL")
    if "boston" in teamName:
        return("BOS")
    if "brooklyn" in teamName:
        if year <= 2012:
            return("NJN")
        else:
            return("BRK")
    if "charlotte" in teamName:
        if year <= 2002:
            return("CHH")
        if year >= 2015:
            return("CHO")
        else:
            return("CHA")
    if "orleans" in teamName:
        if year >= 2014:
            return("NOP")
        if year == 2006 or year == 2007:
            return("NOK")
        else:
            return("NOH")
    if "chicago" in teamName:
        return("CHI")
    if "cleveland" in teamName:
        return("CLE")
    if "dallas" in teamName:
        return("DAL")
    if "denver" in teamName:
        return("DEN")
    if "detroit" in teamName:
        return("DET")
    if "golden" in teamName:
        return("GSW")
    if "houston" in teamName:
        return("HOU")
    if "indiana" in teamName:
        return("IND")
    if "clippers" in teamName:
        return("LAC")
    if "lakers" in teamName:
        return("LAL")
    if "grizzlies" in teamName:
        if year <= 2001:
            return("VAN")
        else:
            return("MEM")
    if "miami" in teamName:
        return("MIA")
    if "bucks" in teamName:
        return("MIL")
    if "minnesota" in teamName:
        return("MIN")
    if "york" in teamName:
        return("NYK")
    if "oklahoma" in teamName:
        if year <= 2008:
            return("SEA")
        else:
            return("OKC")
    if "orlando" in teamName:
        return("ORL")
    if "phil" in teamName:
        return("PHI")
    if "phoe" in teamName:
        return("PHX")
    if "portland" in teamName:
        return("POR")
    if "sacramento" in teamName:
        return("SAC")
    if "spurs" in teamName:
        return("SAS")
    if "toronto" in teamName:
        return("TOR")
    if "utah" in teamName:
        return("UTA")
    if "washington" in teamName:
        return("WAS")

year = 2023
conn = sqlite3.connect('Databases/Main.db')
cursor = conn.cursor()

while year > 1990:

    sqlYearString = "{0}_{1}".format(year-1, year)
    yearForUrl = "{0}-{1}".format(year-1, year)
    leagueCap = CapHistory(yearForUrl)

    newTable = "SalariesHH_{}".format(sqlYearString)
    sqlDropTable = "DROP TABLE IF EXISTS {}".format(newTable)
    sqlCreateTable = """ 
    CREATE TABLE IF NOT EXISTS {} (
    Pk int PRIMARY KEY,
    Name varchar(50),
    Salary int,
    Team varchar(3),
    TeamPayroll int,
    LeagueCap int,
    PercOfTeamPayroll decimal(4,2),
    PercOfLeagueCap decimal(4,2)
    ) """.format(newTable)

    with conn:
        cursor.execute(sqlDropTable)
        cursor.execute(sqlCreateTable)
        conn.commit()

    pk = 1
    for team in teamList:   

        teamAbr = TeamAbbreviation(team)
        if year == 2023: url = "https://hoopshype.com/salaries/{0}/".format(team)
        else: url = "https://hoopshype.com/salaries/{0}/{1}".format(team, yearForUrl)
        
        page = requests.get(url)
        soup = BeautifulSoup(page.content, 'html.parser')

        rows = soup.find_all("tr")
        rowData = [[td.getText() for td in rows[i].findAll('td')] for i in range(len(rows))]
        
        if len(rowData) > 1:
            teamPayrollDiv = soup.find("div", class_="payroll-totals")
            teamPayrollStr = teamPayrollDiv.find('span').get_text()
            teamPayroll = int(teamPayrollStr.replace('$','').replace(',',''))


            for row in rowData[2:]:
                if row[0].lower() != 'totals' and len(row[1].strip()) > 0:
                    playerName = NormalizeName(row[0].strip())
                    playerSalary = int(row[1].replace('$','').replace(',',''))

                    # ===================================
                    #   Calculate percentages
                    # ===================================
                    percOfTeamPayroll = round((playerSalary / teamPayroll)*100, 2)
                    percOfLeagueCap = round((playerSalary / leagueCap)*100, 2)

                    sqlInsert = """ 
                    INSERT INTO SalariesHH_{0} VALUES (?,?,?,?,?,?,?,?)
                    """.format(sqlYearString)

                    with conn:
                        cursor.execute(sqlInsert, [
                            pk, playerName, playerSalary, teamAbr, teamPayroll, 
                            leagueCap, percOfTeamPayroll, percOfLeagueCap
                        ])
                        conn.commit()
                    pk += 1
    print(newTable)
    year -= 1
        
        

