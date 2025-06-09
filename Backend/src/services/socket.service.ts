import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import config from '../config/config';
import User from '../models/user';
import Item from '../models/item';
import { removeItem } from '../controllers/item.controller';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize Socket.IO server
   */
  public init(io: Server): void {
    this.io = io;

    // JWT authentication for socket.io
    io.use((socket: Socket, next) => {
      const token =
        (socket.handshake.query?.token as string) ||
        (socket.handshake.auth as any)?.token;

      if (token) {
        jwt.verify(token, config.jwtSecret, (err: jwt.VerifyErrors | null, decoded: any) => {
          if (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.data.decoded_token = decoded;
          next();
        });
      } else {
        console.error('Socket auth error: No token provided');
        next(new Error('Authentication error: No token provided'));
      }
    });

    console.log('Socket service initialized');
    this.setupSocketEvents();
    this.startAuctionTimer();
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEvents(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const username = socket.data.decoded_token.username;
      console.log(`${username} user connected`);

      // Store client in the maps
      this.socketIDbyUsername.set(username, socket.id);
      this.usernamebySocketID.set(socket.id, username);

      // Handle new user event
      socket.on('newUser:username', async (data: any) => {
        try {
          // Accept both string and object for flexibility
          const usernameFromClient = typeof data === 'string' ? data : data.username;

          // Mark user as online in DB
          await User.findOneAndUpdate({ usernameFromClient }, { online: true });

          // Update socket maps
          this.socketIDbyUsername.set(usernameFromClient, socket.id);
          this.usernamebySocketID.set(socket.id, usernameFromClient);

          // Broadcast to all clients about the new logged-in user
          this.newLoggedUserBroadcast(usernameFromClient);
        } catch (err) {
          console.error('Error handling newUser:username:', err);
        }
      });

      // Handle bid event
      socket.on('send:bid', async (bidData) => {
        try {
          const { description, amount, username } = bidData;
          // Find the item by description
          const item = await Item.findOne({ description });
          
          if (!item || item.sold) return;
          
          // Buy now integration
          if (amount >= item.buynow) {
            item.sold = true;
            item.wininguser = username;
            console.log(`Item "${description}" bought now by ${username} for ${amount}`);
            this.itemSoldBroadcast(item);
            await Item.deleteOne({ description: item.description });
            // Instantly broadcast updated items list
            const updatedItems = await Item.find({}, { __v: 0 });
            if (this.io) {
              this.io.emit('items:update', updatedItems);
            }
            return;
          }
          // Validate bid
          if (amount > item.currentbid) {
            item.currentbid = amount;
            item.wininguser = username;
            await item.save();
            console.log(`Bid accepted for item "${description}" by ${username} with amount ${amount}`);
            // Instantly broadcast updated items list
            const updatedItems = await Item.find({}, { __v: 0 });
            if(this.io) {
              this.io.emit('items:update', updatedItems);
            }
          }
        } catch (err) {
          console.error('Error handling send:bid:', err);
        }
      });

      // Handle remove:item event
      socket.on('remove:item', async (data: any) => {
        try {
          const { description } = data;
          if (!description) return;
          await Item.deleteOne({ description });
          this.itemRemovedBroadcast({ description });
          // Instantly broadcast updated items list
          const updatedItems = await Item.find({}, { __v: 0 });
          if (this.io) {
            this.io.emit('items:update', updatedItems);
          }
        } catch (err) {
          console.error('Error handling remove:item:', err);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
          // Mark user as offline in DB
          await User.findOneAndUpdate({ username }, { online: false });
          this.userLoggedOutBroadcast({ username });
          console.log(`${username} user disconnected`);
        }
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  /**
   * Start auction timer for item remaining time updates
   */
  private startAuctionTimer(): void {
    this.intervalId = setInterval(async () => {
      try {
        // Fetch all items from the database
        const items = await Item.find({}, { __v: 0 });

        // Decrement remainingtime for each item if it's greater than 0
        for (const item of items) {
          if (item.remainingtime > 0) {
            item.remainingtime -= 1;

            if (item.remainingtime === 0 && !item.sold) {
              item.sold = true;
              this.itemSoldBroadcast(item);
              await Item.deleteOne({ description: item.description }); // Remove by description
              continue; // Skip saving since it's deleted
            }

            await item.save();
          }
        }

      } catch (err) {
        console.error('Error in auction timer:', err);
      }
    }, 1000); // 1000 ms = 1 second
  }

  /**
   * Broadcast new logged-in user to all clients
   */
  public newLoggedUserBroadcast(newUser: any): void {
    if (this.io) {
      this.io.emit('new:user', newUser);
    }
  }

  /**
   * Broadcast user logged-out event to all clients
   */
  public userLoggedOutBroadcast(loggedOutUser: any): void {
    if (this.io) {
      this.io.emit('user:loggedOut', loggedOutUser);
    }
  }

  /**
   * Broadcast item sold event to all clients
   */
  public itemSoldBroadcast(item: any): void {
    if (this.io) {
      this.io.emit('item:sold', item);
    }
  }

    public itemRemovedBroadcast(item: any): void {
      if (this.io) {
        this.io.emit('remove:item', item);
      }
    }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();