import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import User from '../models/user';
import config from '../config/config';

/**
 * Handle user authentication
 * Note: Original dummy functionality
 */
export const authenticate = (req: Request, res: Response): void => {
  console.log('Authenticate -> Received Authentication POST');
  
  // Generate JWT token youshould use a real user authentication here check in the database
  User.findOne({ username: req.body.username })
  // For now, we are just signing the request body
  const token = jwt.sign(req.body, config.jwtSecret);
  
  // Send response with token
  res.json({
    username: req.body.username,
    token
  });
  
  console.log('Authenticate -> Received Authentication POST');
};

/**
 * Handle user registration
 * Note: Original dummy functionality
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  // Manual validation (since express-validator is not used)
  const { name, email, username, password, latitude, longitude } = req.body;
  if (!name || !email || !username || !password) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(409).json({ message: 'User with this email or username already exists.' });
      return;
    }

    // TODO: Hash password before saving in production!
    const newUser = new User({
      name,
      email,
      username,
      password,
      latitude,
      longitude
    });

    const savedUser = await newUser.save();

    // Respond with created user (omit password)
    res.status(201).json({
      _id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      username: savedUser.username,
      latitude: savedUser.latitude,
      longitude: savedUser.longitude
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all users
 * Note: Maintaining original dummy functionality
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all users from the database, omitting passwords for security
    const users = await User.find({}, { password: 0 });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};