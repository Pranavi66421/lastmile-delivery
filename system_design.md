# Enterprise Logistics Architecture & System Design

This document details the system design, pricing mathematics, geospatial engines, and fail-safe scheduling workflows implemented in the Enterprise Last-Mile Delivery Optimizer.

---

## 1. Rate Calculation Engine

The billing system evaluates order costs dynamically based on dimensional metrics and environmental factors, ensuring maximum revenue capture.

### Weight Dimensionality Heuristics
To optimize space allocation in courier vehicles, the pricing engine compares the physical weight against the space volume occupied by the package:
- **Volumetric Weight**: Evaluated by the logistics-standard divisor formula:
  $$\text{Volumetric Weight (kg)} = \frac{\text{Length (cm)} \times \text{Width (cm)} \times \text{Height (cm)}}{5000}$$
- **Billing Weight**: The final taxable weight is modeled as:
  $$\text{Billing Weight (kg)} = \max(\text{Actual Weight}, \text{Volumetric Weight})$$

### Matrix Rate Lookup
Pricing variables are database-driven to enable real-time updates. The base rates and incremental charges are separated by SLA tiers:
1. **B2B Tier**: High-priority corporate contracts, higher base fees, but lower incremental per-kg rates.
2. **B2C Tier**: Standard consumer deliveries, lower entry costs, but higher incremental weight charges.

The calculation evaluates whether the pickup and drop-off coordinates are within the same geographical zone (**Intra-Zone**) or cross boundaries (**Inter-Zone**), charging the respective per-kg rate on weight exceeding the base allocation:
$$\text{Base Charge} + (\max(0, \text{Billing Weight} - \text{Base Weight}) \times \text{Zone Rate/kg}) = \text{Subtotal}$$

### Dynamic Surcharges (Environmental Premiums)
A key differentiator is the environmental surcharge compiler, which queries real-time conditions (weather and traffic index) to apply safety premiums and congestion fees:
$$\text{Total Fee} = \text{Subtotal} \times (1 + \text{Weather Premium} + \text{Traffic Premium}) + \text{COD Flat Surcharge}$$

---

## 2. Geospatial Zone Detection

The system models operational zones as circular regions defined by:
$$\text{Zone} = \{(\text{lat}, \text{lng}, r) \mid \text{lat}, \text{lng} \in \mathbb{R}, r \in \mathbb{R}^+\}$$

### Point-in-Zone Math
To assign pickup/drop coordinates to operational zones, the system evaluates the geodesic distance using the Haversine formula:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
Where:
- $\phi$ represents latitude, $\lambda$ represents longitude.
- $R$ is Earth's mean radius (6,371 km).

If $d \le r$, the coordinate is flagged as inside the zone. If a coordinate falls inside multiple zones, the closest zone center is matched.

---

## 3. Priority-Weighted Auto-Assignment Heuristic

The auto-assignment coordinator pairs orders with active riders using a quality-weighted proximity scoring model.

### Distance Matrix Ranking
When an order is created or rescheduled, the backend queries all active and available couriers. The distance $D_a$ between the courier's GPS location and the pickup point is calculated.

### Performance Incentivization Score
To reward high-performing couriers and maintain SLA delivery standards, the system calculates an assignment suitability score $S_a$:
$$S_a = D_a \times \left(1.3 - \frac{\text{Courier Rating}}{5.0}\right)$$
- Couriers with perfect ⭐ 5.0 ratings receive a **0.8x multiplier**, making them highly competitive for nearby dispatches.
- Low-rated couriers (e.g., ⭐ 3.0) receive a **1.2x penalty multiplier**, reducing unnecessary dispatches.
The courier with the **lowest score** is assigned.

---

## 4. Failed Delivery & Co-Route Rescheduling

Deliveries can fail due to customer absence or address issues. The system manages this via an immutable state machine and an ecological scheduling heuristic.

### Immutable Status Transition Audit
All order states transition sequentially:
`Created` $\rightarrow$ `Assigned` $\rightarrow$ `Picked Up` $\rightarrow$ `In Transit` $\rightarrow$ `Out for Delivery` $\rightarrow$ `Delivered` OR `Failed`
Each transition writes to the database audit trail logging:
- Status transition (from/to)
- Actor ID & Username (Customer, Rider, or Admin)
- Timestamp and custom remarks (e.g., reason for failure, coordinates mismatch)

### Co-Routing Rescheduling Heatmap
To reduce deadhead travel and lower carbon footprints, rescheduled deliveries are guided:
1. The customer selects a target rescheduling date.
2. The backend analyzes all scheduled deliveries for that zone on that date.
3. High-density delivery hours are flagged as **High Efficiency (Green)**.
4. Selecting a green slot routes the order into the existing Traveling Salesperson optimized path for that day, offering a minor shipping discount as an incentive.
5. The courier is unassigned from the failed attempt, and reassigned to the closest available rider for the new date's batch.
