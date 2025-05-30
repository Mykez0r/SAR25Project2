import { Request, Response } from 'express';
import Item from '../models/item';

/**
 * Create a new item
 * Note: original dummy functionality
 */
export const createItem = async (req: Request, res: Response): Promise <void> => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);

  const { description, currentbid, remainingtime, buynow, wininguser, sold, owner } = req.body;
  if ( !description || currentbid === undefined || remainingtime === undefined) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }

  try{

    const newItem = new Item({
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
export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Item.find({}, { __v: 0 });
    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};