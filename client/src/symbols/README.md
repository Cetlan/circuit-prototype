# Component Engine (`/src/components`)

This directory houses the core subsystem responsible for managing, loading, and parsing component schema descriptors. It acts as the single source of truth that translates visual schematic interactions into valid simulation netlists or analytics models.

## Core Responsibilities

1. **Schema Retrieval & Hydration:** Orchestrates the processing of component schemas, interfacing with network clients to resolve remote layout URLs into flat, inline assets.
2. **Netlist Compilation:** Linearly transforms structural node connections into correctly ordered simulation syntax based on active engine/target parameters.
3. **UI Form Generation:** Exposes property metadata maps to the front-end sidebar panel to automatically construct type-safe property editors.

---

## Schema Formats & Examples

Every component descriptor must be structured explicitly. The `simulation` block is an optional array allowing a single component to support multiple behavioral models or simulation domains.

### 1. Resistor (Standard Primitive)

Demonstrates a basic two-pin primitive with a single default SPICE target mapping directly to the pins exposed inside the inline SVG template.

```json
{
  "name": "Resistor",
  "prefix": "R",
  "symbol": {
    "source": "inline",
    "data": "<svg height='100' width='100'><path d='M0,50 L30,50 L40,30 L50,70 L60,30 L70,50 L100,50' /><circle cx='0' cy='50' r='4' data-pin-name='positive'/><circle cx='100' cy='50' r='4' data-pin-name='negative'/></svg>"
  },
  "properties": {
    "resistance": {
      "label": "Resistance (Ω)",
      "type": "string",
      "default": "1k"
    }
  },
  "simulation": [
    {
      "engine": "spice",
      "target": "default",
      "pins": ["positive", "negative"]
    }
  ]
}
```

### 2. Op-Amp (Multi-Target Array Model)

Demonstrates a multi-pin subcircuit component using the simulation target overrides to elegantly manage different underlying positional netlist pin sequences (ideal vs detailed) for the same remote SVG symbol hooks.

```json
{
  "name": "LM741 Operational Amplifier",
  "prefix": "X",
  "symbol": {
    "source": "remote",
    "url": "/api/v1/assets/symbols/ics/lm741.svg"
  },
  "properties": {
    "modelLevel": {
      "label": "Simulation Model",
      "type": "select",
      "options": ["ideal", "detailed"],
      "default": "ideal"
    },
    "modelName": {
      "label": "Model Name",
      "type": "string",
      "default": "LM741",
      "visible": false
    }
  },
  "simulation": [
    {
      "engine": "spice",
      "target": "ideal",
      "paramFormat": "IDEAL_OPAMP_MODEL",
      "pins": ["non_inverting", "inverting", "v_plus", "v_minus", "output"]
    },
    {
      "engine": "spice",
      "target": "detailed",
      "paramFormat": "${modelName}",
      "modelDefinition": ".subckt LM741 non_inverting inverting v_plus v_minus output \n* Transistor-level definitions go here... \n.ends",
      "pins": ["non_inverting", "inverting", "v_plus", "v_minus", "output"]
    }
  ]
}
```

### 3. Mounting Bracket (Non-Simulated Mechanical Part)

Demonstrates a physical, mechanical component required solely for structural layout and Bill of Materials (BOM) compiling. Because it contains no simulation nodes, it drops targets entirely.

```json
{
  "name": "TO-220 Heatsink Bracket",
  "prefix": "MECH",
  "symbol": {
    "source": "remote",
    "url": "/api/v1/assets/symbols/mech/bracket_to220.svg"
  },
  "properties": {
    "material": {
      "label": "Material",
      "type": "select",
      "options": ["Aluminum", "Copper"],
      "default": "Aluminum"
    }
  },
  "simulation": []
}
```

> **Note:** While the above examples include multiple possible representations of a component, resources returned from this subsystem must only be fully "hydrated" components. Additionally, the `simulation` block is structured as an optional array of simulation targets, allowing a single component definition to seamlessly support multiple behavioral models (e.g., "ideal" vs. "detailed") or entirely different simulation engines without altering the visual schematic layout.
