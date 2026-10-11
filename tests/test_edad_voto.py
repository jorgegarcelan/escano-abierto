from escano import edad_voto as ev

TEXTO = """
Pregunta 6aR
¿Y podría decirme a qué partido o coalición votó?
  PP                  23,9       24,6        23,2        18,0       18,9       22,4       28,0       23,8       22,3         28,8
  PSOE                28,7       26,4        30,8        29,5       26,4       24,5       25,4       31,6       34,9         29,7
  Otro partido         1,6        2,2         1,0         3,0        2,4        2,5        1,1        1,2        1,1          0,5
  (N)              (8.976)    (4.286)     (4.690)       (678)    (1.000)    (1.460)    (1.766)    (1.632)    (1.226)      (1.213)

Pregunta 6aa
  PP                  21,2       21,6        20,8        14,4       15,7       19,7       24,9       22,0       20,9         26,3
  (N)             (10.104)    (4.884)     (5.220)       (846)    (1.208)    (1.659)    (1.990)    (1.769)    (1.307)      (1.326)
Pág 15
"""


def test_tabla_del_cis_hasta_la_siguiente_pregunta():
    filas, n = ev._tabla(TEXTO, "6aR")
    assert filas["PP"][3:5] == [18.0, 18.9]          # las edades empiezan en la cuarta columna
    assert filas["Otro partido"][0] == 1.6
    assert n == [8976, 4286, 4690, 678, 1000, 1460, 1766, 1632, 1226, 1213]   # su (N), no el de la 6aa
    assert ev._tabla(TEXTO, "6aa")[0]["PP"][-1] == 26.3
