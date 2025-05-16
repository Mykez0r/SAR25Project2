import { Request, Response } from 'express';
import Item from '../models/item';

/**
 * Create a new item
 * Note: original dummy functionality
 */
export const createItem = async (req: Request, res: Response): Promise <void> => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);

  const {id, description, currentbid, remainingtime, buynow, wininguser, sold, owner } = req.body;
  if (!id || !description || currentbid === undefined || remainingtime === undefined) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }

  try{

    const newItem = new Item({
      id,
      description,
      currentbid,
      remainingtime,
      buynow,
      wininguser,
      sold,
      owner
    });

    const savedItem = await newItem.save();
    //Respond with created item
    res.status(201).json({
      id: savedItem.id,
      description: savedItem.description,
      currentbid: savedItem.currentbid,
      remainingtime: savedItem.remainingtime,
      buynow: savedItem.buynow,
      winninguser: savedItem.wininguser,
      sold: savedItem.sold,
      owner: savedItem.owner
    });
      } catch (error) {
    console.error('Error registering Item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }

  }

/**
 * Remove an existing item
 * Note: original dummy functionality
 */
export const removeItem = (req: Request, res: Response): void => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);
  
  // No response was sent in the original code
  res.status(200).end();
};

/**
 * Get all items
 * Note: original dummy functionality
 */
export const getItems = (req: Request, res: Response): void => {
  // Create dummy items 
  const items = [
    {
      description: 'Smartphone',
      currentbid: 250,
      remainingtime: 120,
      buynow: 1000,
      wininguser: 'dummyuser1',
      sold: false,
      owner: 'dummyowner1',
      id: 1
    },
    {
      description: 'Tablet',
      currentbid: 300,
      remainingtime: 120,
      buynow: 940,
      wininguser: 'dummyuser2',
      sold: false,
      owner: 'dummyowner2',
      id: 2
    },
    {
      description: 'Computer',
      currentbid: 120,
      remainingtime: 120,
      buynow: 880,
      wininguser: 'dummyuser3',
      sold: false,
      owner: 'dummyowner3',
      id: 3
    }
  ];
  
  // Send response
  res.json(items);
  console.log("received get Items call responded with: ", items);
};