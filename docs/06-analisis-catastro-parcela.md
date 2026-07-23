# Analisis Catastro - Parcela Candidata

Fecha de analisis: 2026-07-23.

Carpeta local analizada: `Catastro/`.

Nota de privacidad: los archivos catastrales brutos no se suben al repositorio por defecto, ya que pueden contener documentos oficiales, referencias y datos personales. Este documento recoge solo la sintesis tecnica util para el proyecto.

## Identificacion

| Campo | Dato |
|---|---|
| Referencia catastral de parcela | 8029330VK0082N |
| Referencia catastral de inmueble | 8029330VK0082N0001UD |
| Localizacion | CL ALIMOCHE 49, 45123 Layos, Toledo |
| Clase | Urbano |
| Uso principal | Suelo sin edificar |
| Superficie grafica | 578 m2 |
| Superficie construida sobre rasante | 0 m2 |
| Superficie construida bajo rasante | 0 m2 |
| Fecha de descarga/consulta | 23/07/2026 |

## Archivos Recibidos

| Archivo | Utilidad |
|---|---|
| `Sede Electronica del Catastro - Consulta y certificacion de Bien Inmueble.pdf` | Ficha catastral descriptiva del inmueble. Confirma referencia, direccion, clase, uso y superficie grafica. |
| `FXCC_8029330VK0082N.pdf` | Croquis catastral a escala 1:250. Muy util para lectura rapida de forma, calle y superficie. |
| `Ayuda del visor de cartografia de la Sede Electronica del Catastro.pdf` | Explica descargas del visor: DXF, GML, XML, seleccion de parcelas, coordenadas y herramientas. |
| `8029330VK0082N.gml` | Geometria oficial INSPIRE de parcela catastral en ETRS89 / UTM huso 30N, EPSG:25830. Es el archivo mas fiable para mediciones. |
| `8029330VK0082N.kml` | KML con contorno de parcela y punto de localizacion para Google Earth/visor GIS. |
| `8029330VK0082N-2.kml` | KML de localizacion/punto del inmueble, con enlace a Catastro. |
| `8029330VK0082N.zip` | DXF y ASC de la parcela 8029330VK0082N. |
| `8029330VK0082N-2.zip` | DXF y ASC de varias parcelas cercanas/seleccionadas: 8029330, 8029331, 8029329, 8029325, 8029326 y 8029327. Sirve para estudiar contexto inmediato. |
| `8029330VK0082N-3.zip` | DXF y ASC de la referencia completa del inmueble 8029330VK0082N0001UD. |
| `Listado_inmuebles.xlsx` | Listado de inmuebles: confirma que solo hay inmueble urbano, sin datos rusticos ni especiales. |

## Geometria De La Parcela

Sistema de coordenadas del GML: **ETRS89 / UTM zona 30N, EPSG:25830**.

Superficie catastral: **578 m2**.

Superficie calculada desde el poligono GML: **578,01 m2**.

Perimetro aproximado: **97,77 m**.

Numero de vertices utiles: **5**, aunque uno de ellos es practicamente coincidente con el anterior y funciona como quiebro minimo. Geometricamente se comporta casi como un cuadrilatero irregular.

## Vertices UTM Del GML

| Vertice | X | Y |
|---:|---:|---:|
| 1 | 407940.87 | 4402505.85 |
| 2 | 407964.13 | 4402523.80 |
| 3 | 407975.69 | 4402507.40 |
| 4 | 407953.37 | 4402490.15 |
| 5 | 407953.33 | 4402490.12 |

Punto de referencia catastral: **407958.46, 4402505.34**.

Centro aproximado en KML: **39.7675204, -4.0746336**.

## Lados Principales

| Lado | Longitud aprox. | Azimut aprox. |
|---|---:|---:|
| 1-2 | 29,38 m | 52,3 grados |
| 2-3 | 20,06 m | 144,8 grados |
| 3-4 | 28,21 m | 232,3 grados |
| 4-5 | 0,05 m | 233,1 grados |
| 5-1 | 20,07 m | 321,6 grados |

Lectura geometrica: parcela compacta, con dos lados largos de unos 28-29 m y dos lados cortos de unos 20 m. La forma es favorable para una vivienda de una planta compacta, pero no sobra superficie si se pretende vivienda en U, garaje doble, porches amplios y exterior pavimentado.

## Lectura Arquitectonica Inicial

### Fortalezas

- Superficie suficiente para una vivienda compacta de 100-120 m2 interiores.
- Forma relativamente regular y aprovechable.
- Solar sin edificacion, lo que simplifica demoliciones y condicionantes previos.
- Relacion de lados razonable para vivienda en U ligera o L con pergola.
- Buena escala para una casa de bajo mantenimiento.

### Debilidades

- 578 m2 no es una parcela grande para sumar vivienda, garaje doble, porches amplios, patio pavimentado y eventual piscina.
- La vivienda en U compacta podria consumir demasiada ocupacion y generar retranqueos dificiles, pendiente de normativa.
- Falta conocer orientacion exacta de calle, pendiente real, acometidas, rasantes y condiciones urbanisticas.
- La superficie disponible obliga a controlar mucho circulaciones y patios residuales.

### Oportunidades

- Diseñar una **U ligera** donde garaje/anexo y porches construyan el patio sin aumentar demasiado la vivienda climatizada.
- Usar el patio como pieza bioclimatica: sombra, ventilacion, privacidad y expansion visual del salon.
- Reservar una pequena lamina de agua o piscina ornamental solo si no compromete presupuesto ni ocupacion.
- Concentrar instalaciones en una banda tecnica junto a garaje/lavadero para abaratar obra.

### Riesgos

- Comprar sin confirmar planeamiento urbanistico: retranqueos, ocupacion maxima, edificabilidad y alineaciones podrian condicionar totalmente la U.
- Orientar mal el gran ventanal y sobrecalentar la vivienda en verano.
- Exceder presupuesto por urbanizacion exterior, muros, pavimentos, pergolas y carpinterias.
- Confiar solo en Catastro: Catastro no sustituye levantamiento topografico, geotecnico ni certificacion urbanistica.

## Implicaciones Para El Diseno

Con esta parcela, las tres alternativas quedan asi:

| Alternativa | Encaje preliminar |
|---|---|
| U ligera | Mejor opcion inicial. Permite patio protegido y garaje como tercer brazo sin disparar m2 interiores. |
| L con pergola | Opcion de control economico. Muy razonable si la normativa aprieta retranqueos u ocupacion. |
| U compacta | Mas dificil. Solo viable si la normativa permite buena ocupacion y se mantiene una planta muy ajustada. |

## Informacion Pendiente Critica

Antes de avanzar a propuesta arquitectonica seria necesario obtener:

- Ordenanza urbanistica aplicable a CL Alimoche 49 en Layos Golf.
- Edificabilidad maxima.
- Ocupacion maxima.
- Retranqueos a calle, linderos laterales y fondo.
- Altura maxima y numero de plantas permitido.
- Condiciones de cerramiento, garaje, porches y pergolas.
- Si porches computan o no computan a efectos urbanisticos.
- Pendiente/rasantes reales mediante levantamiento topografico.
- Estudio geotecnico cuando la compra avance.
- Orientacion solar exacta y sombras del entorno.

## Recomendacion Actual

La parcela es compatible con el concepto del proyecto, pero obliga a una estrategia compacta. La linea de trabajo recomendada sigue siendo:

**vivienda de una planta en U ligera, 100-115 m2 interiores, garaje/anexo economico, patio protegido, porches amplios pero racionales, y piscina pospuesta o reducida a lamina de agua opcional.**

No debe comprarse ni cerrarse el diseno final sin comprobar planeamiento municipal y retranqueos aplicables.
