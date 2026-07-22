# Catálogo Completo de Componentes de CADe SIMU (v4.2) para zCADe

Este documento contiene la lista exhaustiva de todos los componentes, elementos y símbolos disponibles en CADe SIMU v4.x, organizados por librerías y categorías funcionales.

Está diseñado con la nomenclatura, bornes de conexión (según norma IEC 60617) y lógica de funcionamiento necesaria para que Claude Code pueda implementar la librería de componentes en zCADe.

**Estado**: documento de referencia de dominio (Zuzo, Product Owner). Es la fuente detallada de bornes/nomenclatura para implementar componentes; `CLAUDE.md`'s "Component Library (Core Types)" es el resumen de alto nivel y enlaza aquí. Los Tiers de `COMPLETE_PROJECT_ROADMAP.md` (Tier 1 en Fase A, Tier 2/3 en Fase D) deben seleccionarse de este catálogo, no inventarse aparte.

---

## 1. Alimentaciones y Fuentes de Energía (Power Supplies)

Esta librería define el origen de potencial eléctrico para los esquemas de potencia, mando y continua.

* **Alimentación de Fase (L)**: Borne único de potencial de fase para circuitos AC monofásicos/trifásicos.
* **Alimentación de Neutro (N)**: Borne de potencial neutro de referencia para AC.
* **Alimentación de Tierra (PE)**: Borne de protección a tierra (Verde-Amarillo).
* **Alimentación Combinada Monofásica (L+N / L+N+PE)**: Bloque compuesto con salidas agrupadas a distancia de rejilla estándar (10px).
* **Alimentación Trifásica (L1+L2+L3)**: Sistema trifásico de potencia a 3 hilos (400VAC / 380VAC).
* **Alimentación Trifásica Completa (L1+L2+L3+N / L1+L2+L3+PE / L1+L2+L3+N+PE)**: Salida agrupada para embarrados de cuadros de distribución.
* **Fuente de Alimentación DC Positiva (+24V)**: Borne de potencial positivo para circuitos de mando industrial.
* **Fuente de Alimentación DC Negativa (0V / GND)**: Borne de potencial negativo/masa de mando.
* **Transformador Monofásico**:
  * *Entrada:* L1, L2 (Primario) | *Salida:* u, v (Secundario).
  * Convierte tensión de potencia (ej. 400V/230V) a tensión de seguridad de mando (ej. 24VAC).
* **Transformador Trifásico**: Bobinado primario y secundario en configuración Estrella o Triángulo.
* **Puente Rectificador de Diodos (Monofásico/Trifásico)**: Convierte corriente alterna (AC) en corriente continua (DC). Bornes ~, ~, +, -.
* **Batería / Acumulador DC**: Fuente fija con indicación de polaridad positivo/negativo.

---

## 2. Fusibles y Protecciones Pasivas (Fuses & Disconnectors)

Elementos de protección contra cortocircuitos mediante fusión.

* **Fusible Monofásico (1P)**: Borne de entrada (1) y salida (2).
* **Fusibles Multipolares (1P+N, 2P, 3P, 3P+N, 4P)**: Agrupaciones mecánicas para líneas polifásicas (Bornes 1-2, 3-4, 5-6, 7-8).
* **Seccionador portafusibles**: Incorpora palanca de accionamiento manual que permite aislar el circuito abriendo los contactos de fusible simultáneamente.

---

## 3. Disyuntores, Interruptores Automáticos y Relés de Protección (Circuit Breakers & Overload Relays)

Protección activa frente a sobrecargas y cortocircuitos.

* **Interruptor Magnetotérmico / Disyuntor (1P, 2P, 3P, 4P)**:
  * Protege cables contra cortocircuitos y sobrecargas.
  * *Bornes de potencia:* 1-2, 3-4, 5-6, 7-8.
* **Relé Térmico de Sobrecarga (Relé Térmico / Guardamotor auxiliar)**:
  * *Contactos de potencia:* 1-2, 3-4, 5-6 (van en serie con el motor).
  * *Contactos auxiliares asociados:*
    * **NC (95-96)**: Para desenergizar la maniobra en caso de disparo por sobretemperatura.
    * **NO (97-98)**: Para activar piloto de señalización de fallo.
* **Disyuntor Motor / Guardamotor Magnetotérmico (3P)**:
  * Protege el motor frente a cortocircuito, sobrecarga y fallo de fase. Incorpora botón de rearme (Reset) y disparo mecánico.
* **Interruptor Diferencial / RCD (2P, 4P)**:
  * Protección de personas contra contactos directos e indirectos. Sensibilidad (ej. 30mA). Bornes con botón de prueba (Test).

---

## 4. Contactores e Interruptores de Potencia (Power Contactors)

Elementos de conmutación principal en circuitos de potencia para cargas de alto consumo.

* **Contactos Principales de Contactor (1P, 2P, 3P, 4P)**:
  * Contactos Abiertos (NO) mecánicamente vinculados a una bobina (Tag ej. `KM1`).
  * *Bornes:* 1-2, 3-4, 5-6, 7-8.
* **Contactos Principales Inversores**: Conjunto conmutado para maniobras de cambio de sentido de giro.

---

## 5. Motores y Actuadores Eléctricos (Motors & Loads)

Transformadores de energía eléctrica en energía mecánica o de señal.

* **Motor Trifásico Estándar (3 Bornes - U, V, W)**: Conexión interna fija (Estrella o Triángulo interna).
* **Motor Trifásico de 6 Bornes (U1-V1-W1 / U2-V2-W2)**: Permite cableado externo para maniobras de arranque **Estrella-Triángulo (Y-Δ)**.
* **Motor Trifásico Dahlander (2 Velocidades - 6 Bornes)**: Motor de polos conmutables para dos velocidades por cambio de bobinado.
* **Motor Trifásico de Bobinados Independientes**: Motor con dos devanados separados para dos velocidades independientes.
* **Motor Monofásico (2 Bornes / 4 Bornes con Condensador)**: Incorpora condensador de arranque y/o devanado auxiliar con conmutación de giro.
* **Motor de Corriente Continua (DC)**: Motor de imán permanente o excitación independiente (Bornes + / -).
* **Freno Electromagnético / Freno de Inyección de DC**: Actuador de frenado dinámico para detención rápida de motores.

---

## 6. Variadores de Frecuencia y Arrancadores Suaves (VFD & Soft Starters)

Equipos electrónicos para control avanzado de motores.

* **Arrancador Suave (Soft Starter)**:
  * *Bornes de potencia:* L1, L2, L3 (entrada) -> U, V, W (salida).
  * *Bornes de mando:* Arranque/Parada (Start/Stop), Bypass, Fallo. Permite rampas de aceleración y desaceleración por control de tensión.
* **Variador de Frecuencia (VFD / Inversor Monofásico o Trifásico)**:
  * *Entrada:* L, N o L1, L2, L3.
  * *Salida:* U, V, W hacia el motor.
  * *Mando digital/analógico:* Bornes para potenciómetro (0-10V), marcha hacia adelante (FWD), marcha atrás (REV), velocidades preconfiguradas y salidas de relé de estado.

---

## 7. Pulsadores, Seleccionadores y Mando Manual (Manual Switches & Pushbuttons)

Dispositivos accionados manualmente por el operador.

* **Pulsador Normal (NO - Normal Abierto)**: Contacto impulsivo (Bornes 13-14 o 3-4).
* **Pulsador Normal (NC - Normal Cerrado)**: Contacto impulsivo de paro (Bornes 11-12 o 1-2).
* **Pulsador Doble (NO + NC)**: Un solo botón que al presionarse abre un circuito y cierra otro simultáneamente (Bornes 11-12 y 13-14).
* **Pulsador de Seta de Emergencia (Parada de Emergencia)**: Contacto NC con enclavamiento mecánico tras presionar y desenclavamiento por giro o llave.
* **Selector / Interruptor giratorio (2 o 3 posiciones)**: Conmutadores de posición mantenida (1-0-2).
* **Final de Carrera Mecánico (Limit Switch)**:
  * Accionado por palanca o rodillo.
  * *Contactos:* NO (13-14) y NC (11-12).
* **Interruptor de Pie (Pedal)** y **Presostato/Termostato de maniobra**: Contactos gobernados por variable física.

---

## 8. Bobinas, Temporizadores y Relés Auxiliares (Coils, Timers & Control Relays)

El "cerebro" de la lógica cableada tradicional.

* **Bobina de Contactor / Relé Auxiliar (Estándar)**:
  * *Bornes:* A1 - A2.
  * Al energizarse con la tensión adecuada, conmuta todos los contactos que compartan su misma etiqueta (ej. `KM1`, `KA1`).
* **Bobina de Temporizador a la Conexión (TON - On Delay)**:
  * *Bornes:* A1 - A2.
  * Inicia una cuenta atrás al energizarse; al finalizar el tiempo, conmuta sus contactos asociados.
* **Bobina de Temporizador a la Desconexión (TOF - Off Delay)**:
  * Conmuta los contactos instantáneamente al energizarse y mantiene la conmutación durante un tiempo tras cortar el suministro.
* **Bobina Intermitente / Generador de Impulsos**: Alterna periódicamente la conmutación de sus contactos mientras recibe alimentación.
* **Contactos Auxiliares Instantáneos**:
  * Abiertos (NO: 13-14, 23-24, 33-34, 43-44).
  * Cerrados (NC: 11-12, 21-22, 31-32, 41-42).
* **Contactos Temporizados**:
  * *Temporizados TON:* NO (55-56), NC (57-58).
  * *Temporizados TOF:* NO (65-66), NC (67-68).
* **Relé de Estado Sólido (SSR)**: Entrada de mando optoacoplada (3-4V DC) y salida de conmutación de potencia.

---

## 9. Dispositivos de Señalización (Signaling & Indicators)

* **Piloto Luminoso / Lámpara de Señalización (H)**: Bornes X1 - X2. Colores configurables (Verde, Rojo, Amarillo, Azul, Blanco).
* **Zumbador / Avisador Acústico (Buzzer - H/B)**: Emite señal sonora al energizarse (H1 - H2).
* **Sirena Industrial**: Avisador acústico de alta potencia para emergencias.
* **Display de 7 Segmentos / Indicadores Digitales**: Visualizador de valores numéricos o estados BCD.

---

## 10. Sensores Electrónicos y Captadores Proximidad (Sensors)

* **Detector Inductivo (2, 3 y 4 Hilos - NPN / PNP)**:
  * Detecta presencia de objetos metálicos sin contacto.
  * *Conexión 3 hilos:* Marrón (+24V), Azul (0V), Negro (Señal OUT).
* **Detector Capacitivo (NPN / PNP)**: Detecta materiales no metálicos, líquidos o sólidos.
* **Detector Optoelectrónico / Fotoeléctrico**: Barreras de luz (Emisor/Receptor) o réflex.
* **Detector Magnético (Reed Switch)**: Conmuta mediante el campo magnético de un imán (usado en cilindros neumático-eléctricos).

---

## 11. Autómatas Programables / Módulos PLC (PLCs & Automation)

### 11.1. Módulo Lógico Siemens LOGO! (230RC / 12/24RC)
* **Alimentación:** Bornes L1, N o +24V, 0V.
* **Entradas Digitales:** I1, I2, I3, I4, I5, I6, I7, I8.
* **Salidas por Relé / Transistor:** Q1 (1-2), Q2 (1-2), Q3 (1-2), Q4 (1-2).
* **Pantalla integrada:** Simulación visual de la pantalla retroiluminada de LOGO! mostrando entradas activas, salidas y texto de aviso.

### 11.2. PLC Siemens S7-1200 (CPU 1214C)
* **Alimentación CPU:** L1, N, PE e integración de fuente sensor 24VDC.
* **Entradas Digitales:** Bornes %I0.0 a %I0.7 y %I1.0 a %I1.3.
* **Salidas Digitales:** Bornes %Q0.0 a %Q0.7 y %Q1.0 a %Q1.1.
* **Módulos de Ampliación:** Módulos laterales de entradas/salidas analógicas e I/O digitales adicionales.

### 11.3. Lógica Interna de Programación (Editor Ladder / FBD)
* **Contactos de Entrada:** NO (-| |-), NC (-|/|-).
* **Bobinas de Salida:** Estándar (-( )), SET (-(S)-), RESET (-(R)-).
* **Bloques de Función:** Temporizadores (TON, TOF, TP), Contadores (CTU, CTD), Comparadores (=, >, <), Relés de Impulso.

---

## 12. Módulo GRAFCET (Sequential Function Chart)

* **Etapa Inicial**: Representada por un doble cuadrado. Indica el estado inicial del sistema al iniciar simulación.
* **Etapa Normal**: Cuadrado numerado que representa un estado del proceso.
* **Transición**: Línea horizontal con condición lógica asignada (expresión booleana).
* **Acciones Asociadas**: Bloques rectangulares vinculados a las etapas:
  * **Acción Continua**: Activa mientras la etapa está activa.
  * **Acción Memorizada (Set/Reset)**: Mantiene el estado tras abandonar la etapa.
  * **Acción Temporizada**: Se activa transcurrido un tiempo en la etapa.
* **Divergencia / Convergencia en Y (AND)**: Doble línea horizontal para ramas simultáneas/paralelas.
* **Divergencia / Convergencia en O (OR)**: Línea simple para selección de alternativa de secuencia.

---

## 13. Componentes de Neumática e Hidráulica (Pneumatics & Hydraulics)

### 13.1. Fuentes de Presión y Actuadores
* **Fuente de Presión Neumática**: Compresor / Alimentación de aire comprimido (P).
* **Toma de Escape de Aire**: Salida a la atmósfera silenciosa o libre.
* **Unidad de Mantenimiento (FRL)**: Filtro, Regulador de presión con manómetro y Lubricador.
* **Cilindro de Simple Efecto**: Actuador lineal con retorno por muelle incorporado.
* **Cilindro de Doble Efecto**: Actuador lineal con avance y retroceso controlado por aire. Incorpora detectores magnéticos opcionales (a0, a1).
* **Cilindro Sin Vástago / Actuador Giratorio**: Para desplazamientos largos o giros mecánicos.

### 13.2. Válvulas Distribuidoras y Mando
* **Válvulas 3/2 (3 Vías / 2 Posiciones)**: Accionamiento manual, por rodillo (final de carrera neumático), por aire o por electroválvula (solenoide Y1).
* **Válvulas 5/2 (5 Vías / 2 Posiciones)**: Monoestables (retorno por muelle) y Biestables (dos solenoides Y1, Y2).
* **Válvulas 5/3**: Centro cerrado o centro a descarga.
* **Válvulas Lógicas y Auxiliares**:
  * **Válvula de Simultaneidad (Función Y / AND)**.
  * **Válvula Selectora de Circuito (Función O / OR)**.
  * **Regulador de Caudal Unidireccional** (Estranguladora con antirretorno).
  * **Válvula de Escape Rápido**.
  * **Presostato Neumático**: Convierte señal de presión de aire en contacto eléctrico.

---

## 14. Interfaz de Proceso y Simulación 2D (PC-SIMU Integration)

Módulos de intercambio de datos entre la simulación de esquemas y los paneles visuales:

* **Módulo de Entradas de Proceso (I/O Input Box)**:
  * Mapea señales físicas provenientes de sensores de la escena 2D (ej. sensores de cinta transportadora) hacia las entradas del esquema o PLC.
* **Módulo de Salidas de Proceso (I/O Output Box)**:
  * Mapea salidas del esquema (contactores, electroválvulas) hacia los actuadores de la simulación 2D.
* **Elementos Visuales 2D Integrados**:
  * Cintas transportadoras (Conveyors).
  * Motores rotativos con animación visual de giro.
  * Cilindros neumáticos con animación de avance/retroceso de vástago.
  * Tanques de llenado/vaciado con electroválvulas y detectores de nivel de líquido.
  * Cuadros de mando con pulsadores, interruptores y pilotos 2D.
  * Ascensores / Elevadores industriales de varios pisos.

---

## 15. Sistema de Cableado y Conexiones (Wires & Bus Topology)

* **Cable de Fase**: Color Marrón / Negro / Gris.
* **Cable de Neutro**: Color Azul Claro.
* **Cable de Protección / Tierra (PE)**: Color Verde-Amarillo intermitente.
* **Cable DC Positivo (+)**: Color Rojo.
* **Cable DC Negativo (-)**: Color Azul Oscuro / Negro.
* **Manguera Trifásica (Bus 3P)**: Trazo múltiple simplificado para enrutado rápido de potencia.
* **Punto de Conexión (Junction Dot / Nodo)**: Punto magnético automático que une dos o más cables que se cruzan en T o en Cruz.
* **Bornera de Salida a Cuadro / Regleta de Bornes (Terminal Strips - X1, X2...)**: Representación del conexionado de bornes del armario eléctrico con el exterior.

---

> **Nota para la implementación en zCADe:** Todos estos componentes deben mapearse con su ID único, su símbolo IEC vectorial (SVG con punto de origen 0,0), sus puntos de conexión (pines con coordenadas relativas e indicación de tipo de potencial AC/DC/Neumático) y las etiquetas estándar asignadas por defecto (`KM` para contactores, `Q` para automáticos, `F` para fusibles/térmicos, `S` para pulsadores, `H` para pilotos, `M` para motores, `Y` para electroválvulas).
