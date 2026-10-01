# Modelo de jornadas

Una jornada agrupa un alimento o beneficio, un padrón y los empleados con su punto de atención. Cada jornada posee un identificador independiente: cambiar de punto no cambia de jornada.

| Acción                                          | Administrador                                      | Empleado                                |
| ----------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| Crear accesos, cambiar contraseñas y desactivar | Sí                                                 | No                                      |
| Preparar/habilitar/finalizar jornadas           | Sí                                                 | No                                      |
| Cargar Excel o reutilizar padrón                | Sí                                                 | No                                      |
| Asignar empleados y puntos                      | Sí                                                 | No                                      |
| Consultar DPI y entregar                        | Solo si tiene asignación; no se muestra en su menú | Solo con jornada activa y turno abierto |
| Cerrar su turno                                 | Si tiene asignación                                | Sí                                      |
| Consultar/exportar todo el padrón e historial   | Sí                                                 | No                                      |
| Anular un registro con motivo                   | Sí                                                 | No                                      |

El menú del administrador muestra Jornadas, Consultas e historial y Empleados; el perfil mantiene acceso a su contraseña personal. El empleado solo ve selector de sus jornadas, punto, buscador DPI y cierre de turno.

## Consistencia

`app.register_delivery` bloquea perfil, jornada y asignación mientras registra, y serializa operaciones sobre la persona dentro de esa jornada. El índice único parcial sigue impidiendo más de una entrega vigente por jornada/persona. El cierre de turno toma los bloqueos en un orden compatible y registra el cierre dentro de la misma transacción. Una solicitud nueva después del cierre devuelve `SHIFT_CLOSED`; el reintento de una entrega ya confirmada devuelve su comprobante sin crear otra.

El administrador puede reabrir turnos o la jornada completa. Reabrir no borra entregas; los cierres anteriores se conservan en auditoría. Desactivar el acceso de un empleado conserva también sus registros. Los nombres de beneficiario, punto y empleado de una entrega quedan copiados en el comprobante para que una reasignación no cambie su historia.

## Padrón e informes

La importación permite ubicar DPI/nombres/sector/edad sin asumir posiciones del futuro Excel. El DPI se conserva como texto; la edad es un entero de 0 a 120 tomado del padrón y no se infiere de otro campo. Columnas adicionales permanecen en `extra`. Los filtros de edad excluyen filas sin edad válida.

«No han recibido» se refiere a personas del padrón seleccionado sin entrega vigente. Punto, empleado y fechas se aplican a entregas realizadas; combinarlos con pendientes puede devolver cero resultados. Las fechas se interpretan en la zona del backend; la interfaz usa `VITE_TIMEZONE`, ambas `America/Guatemala` por defecto.

El historial muestra entregas, anulaciones, cierres individuales y cierres globales. Las acciones técnicas de mantenimiento siguen disponibles en la auditoría de la API pero no agregan menús al administrador.
