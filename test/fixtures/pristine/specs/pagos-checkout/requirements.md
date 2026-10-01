---
status: approved
approvedAt: 2026-09-30T10:00:00.000Z
---
# Requisitos — pagos-checkout

## Requisitos

### Requisito 1: Intención de pago
**Historia:** Como cliente, quiero pagar mi carrito, para completar la compra.
#### Criterios de aceptación
1. WHEN el cliente confirma el pago THE SYSTEM SHALL crear un PaymentIntent.
2. THE SYSTEM SHALL guardar el PaymentIntent con estado "pendiente".

### Requisito 2: Validación
**Historia:** Como negocio, quiero validar montos, para evitar cobros erróneos.
#### Criterios de aceptación
1. IF el carrito está vacío THEN THE SYSTEM SHALL responder 400.
2. IF el monto no coincide con la suma del carrito THEN THE SYSTEM SHALL responder 422.
3. WHEN llega un reintento con la misma Idempotency-Key THE SYSTEM SHALL devolver la respuesta original.
