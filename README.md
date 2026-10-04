# Vehicle Metadata Identification Using Machine Learning

<a target="_blank" href="https://cookiecutter-data-science.drivendata.org/">
    <img src="https://img.shields.io/badge/CCDS-Project%20template-328F97?logo=cookiecutter" />
</a>

Team AutoVision, UTS 36127, iLab Project 06

Review console and integration layer for ML-based vehicle metadata extraction.
UTS Data Science & Innovation capstone.

## What this is

A web interface where an analyst can upload vehicle images, see what the model
detected (make, model, colour, body type, damage, accessories), check the
confidence of each detection, and correct anything the model got wrong. Every
correction is recorded in an audit log.

## Repository layout

| Folder | Contents |
|---|---|
| `app/frontend` | React review console (Vite) |
| `app/mock-server` | Node/Express mock API, stands in for the real pipeline |
| `docs` | API contract and design notes |
| `reports` | Weekly reports and slide decks |
| `references` | Project brief and papers |
| `vehicle_metadata_identification_using_machine_learning` | Python package for the ML pipeline and output adapter |
| `models` | Trained model weights (ML team) |
| `data` | Datasets (not committed) |
| `notebooks` | Experiments |

## Running the interface

You need Node.js installed. Use two terminals.

Terminal 1, the mock server:

    cd app/mock-server
    npm install
    node server.js

It should print `Mock API server running at http://localhost:4000`.

Terminal 2, the frontend:

    cd app/frontend
    npm install
    npm run dev

Open the `http://localhost:5173` link it prints. If the page shows
"Unable to reach the detection server", the mock server is not running.

Data is held in memory, so corrections and uploads reset when the server restarts.

## Integrating the ML pipeline

The interface expects each image to produce one JSON object in the format
described in `docs/api-contract.md`. The key rules:

- Confidence values are between 0 and 1, one per attribute.
- Bounding boxes are percentages of the image size, not pixels.
- `conditions`, `features` and `damage` must always be present, as empty lists if nothing was found.

ML code goes in the Python package folder. The adapter that reshapes raw model
output into the contract format belongs there too.

## Status

- Interface and mock backend: working
- Real detection pipeline: pending
- Access control and permanent storage: not started

## Team

- 
- Industry supervisor: Dr Ali Haidar