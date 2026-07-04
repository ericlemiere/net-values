import sqlite3
from NormalizeNameModule import NormalizeName


conn = sqlite3.connect('Databases/Main.db')
cur = conn.cursor()

noMatchList = []

year = 2023

while year > 1990:
    sqlYearString = "{0}_{1}".format(year-1, year)
    print("\n\n============ Home: " + sqlYearString + " ===========\n\n")

    sqlDropTable = """DROP TABLE IF EXISTS Home_{}""".format(sqlYearString)

    sqlCreateTable = """
    CREATE TABLE IF NOT EXISTS Home_{} (
    Pk int PRIMARY KEY,
    Name varchar(50),
    Salary int,
    Team varchar(3),
    TeamPayroll int,
    LeagueCap int,
    PercOfTeamCap decimal(4,2), 
    PercOfLeagueCap decimal(4,2)
    )""".format(sqlYearString)

    sqlSelectPlayerRosters = """
    SELECT * FROM Rosters_{}
    """.format(sqlYearString)

    cur.execute(sqlDropTable)
    cur.execute(sqlCreateTable)
    cur.execute(sqlSelectPlayerRosters)
    playerStatsFetch = cur.fetchall()

    pk = 1
    playerNameHH = ""
    for player in playerStatsFetch:
        playerName = NormalizeName(player[2])
        team = player[1]
        playerNameHH = playerName

        if playerName == "Brandon Boston Jr":
            playerNameHH = "BJ Boston"
        elif playerName == "Kenyon Martin Jr":
            playerNameHH =  "KJ Martin"
        elif playerName == "Javonte Smart":
            playerNameHH = "Ja'Vonte Smart"
        elif playerName == "Maurice Harkless":
            playerNameHH = "Moe Harkless"
        elif playerName == "Enes Freedom":
            playerNameHH = "Enes Kanter"

        # ===================================
        #   Get Salary Info
        # ===================================

        sqlSelectPlayerSalaryHH = """
        SELECT * FROM SalariesHH_{0}
        WHERE Name = "{1}"
        """.format(sqlYearString, playerNameHH)

        cur.execute(sqlSelectPlayerSalaryHH)
        playerSalaryHHFetch = cur.fetchone()
        if playerSalaryHHFetch is not None:
            playerSalary = playerSalaryHHFetch[2]
        else: 
            nameSplit = playerNameHH.split(" ")
            fNameChars = nameSplit[0][0:3]
            lNameChars = nameSplit[1][0:3]
            sqlfName = "%{}%".format(fNameChars)
            sqllName = "%{}%".format(lNameChars)

            sqlSelectPlayerSalaryHH = """
            SELECT * FROM SalariesHH_{0}
            WHERE Name LIKE "{1}" AND Name LIKE "{2}"
            """.format(sqlYearString, sqlfName, sqllName)

            cur.execute(sqlSelectPlayerSalaryHH)
            playerSalaryHHFetch = cur.fetchone()
            if playerSalaryHHFetch is not None:
                playerSalary = playerSalaryHHFetch[2]
            else:
                print(playerName) 
                noMatchList.append(playerName)
                playerSalary = 0

        # ===================================
        #   Get Team and League Cap Info
        # ===================================
        sqlSelectTeamHH = """
        SELECT * FROM TeamPayrollHH_{0}
        WHERE Team = "{1}"
        """.format(sqlYearString, team)

        cur.execute(sqlSelectTeamHH)
        teamPayrollFetch = cur.fetchone()
        teamPayroll = teamPayrollFetch[2]
        leagueCap = teamPayrollFetch[3]

        # ===================================
        #   Calculate percentages
        # ===================================
        percOfTeamCap = round((playerSalary / teamPayroll)*100, 2)
        percOfLeagueCap = round((playerSalary / leagueCap)*100, 2)


        sqlInsert = """ 
        INSERT INTO Home_{0} VALUES (?,?,?,?,?,?,?,?)
        """.format(sqlYearString)

        with conn:
            cur.execute(sqlInsert, [
                pk, playerName, playerSalary, team, teamPayroll, 
                leagueCap, percOfTeamCap, percOfLeagueCap
            ])
            conn.commit()

        pk += 1 
    
    print(sqlYearString + " non matches: " + str(len(noMatchList)))
    noMatchList = []
    year -= 1 
        

