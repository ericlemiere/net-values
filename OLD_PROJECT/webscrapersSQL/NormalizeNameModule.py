

def NormalizeName(name):
    nameNormalized = name.replace("ć", "c").replace("ņ","n").replace("ģ", "g").replace("*", "")
    nameNormalized = nameNormalized.replace("č", "c").replace("ū","u").replace("Š","S")
    nameNormalized = nameNormalized.replace("Ş","S").replace("ü", "u").replace(".","")
    nameNormalized = nameNormalized.replace("ý","y").replace("š", "s").replace("á", "a")
    nameNormalized = nameNormalized.replace("é","e").replace("ö", "o").replace("ā", "a")
    nameNormalized = nameNormalized.replace("Č","C").replace("ó", "o").replace("İ", "I")
    nameNormalized = nameNormalized.replace("ž","z").replace("Ž","Z").replace("Á","A")
    nameNormalized = nameNormalized.replace("ş","s").replace("Ö","O").replace("ğ","g")
    nameNormalized = nameNormalized.replace("í","i").replace("ř","r").replace("ô","o").replace("ï","i")


    if nameNormalized == "Predrag Stojakovic":
        nameNormalized == "Peja Stojakovic"
    return(nameNormalized)