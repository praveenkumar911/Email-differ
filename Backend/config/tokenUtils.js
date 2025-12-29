import { v4 as uuidv4 } from 'uuid';

const generateToken = () => uuidv4();

export { generateToken };