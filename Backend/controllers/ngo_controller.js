import ngoCollection from "../models/ngo.js"; // Adjust path as needed

// GET all NGOs
export const getAllNGOs = async (_, res) => {
    try {
        const ngos = await ngoCollection.find({ verified: true });
        res.status(200).json(ngos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET single NGO by ID
export const getNGOById = async (req, res) => {
    try {
        const ngo = await ngoCollection.findOne({ _id: req.params.id, verified: true });
        if (!ngo) return res.status(404).json({ message: "NGO not found" });
        res.status(200).json(ngo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST create new NGO
export const createNGO = async (req, res) => {
    try {
        const ngo = new ngoCollection({
            ...req.body,
            verified: false,
            created_at: new Date().toISOString()
        });
        const savedNGO = await ngo.save();
        res.status(201).json(savedNGO);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
