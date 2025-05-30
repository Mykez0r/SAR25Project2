import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import User from '../models/user';
import config from '../config/config';
import socketService from '../services/socket.service';

/**
 * Handle user authentication
 * Note: Original dummy functionality
 */
export const authenticate = async (req: Request, res: Response): Promise<void> => {
  console.log('Authenticate -> Received Authentication POST');

  const { username, password } = req.body;

  // Manual validation
  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required.' });
    return;
  }

  try {
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: 'Invalid username or password.' });
      return;
    }

    // In production, use hashed passwords and compare with bcrypt
    if (user.password !== password) {
      res.status(401).json({ message: 'Invalid username or password.' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, username: user.username }, config.jwtSecret);

    // Optionally update user status
    await User.findOneAndUpdate({ username }, { online: true });

    // Broadcast new login
    socketService.newLoggedUserBroadcast({
      _id: user._id,
      username: user.username,
      name: user.name,
    });

    res.json({
      username: user.username,
      token
    });
    console.log('Authenticate -> Authentication successful');
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Handle user registration
 * Note: Original dummy functionality
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  const { name, email, username, password, latitude, longitude } = req.body;
  if (!name || !email || !username || !password) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(409).json({ message: 'User with this email or username already exists.' });
      return;
    }

    const newUser = new User({
      name,
      email,
      username,
      password,
      latitude,
      longitude,
      online: true // Add an 'online' field to your User schema if not present
    });

    const savedUser = await newUser.save();

    // Broadcast new user to all clients
    socketService.newLoggedUserBroadcast({
      _id: savedUser._id,
      username: savedUser.username,
      name: savedUser.name,
    });

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
    const users = await User.find({}, { password: 0 });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};