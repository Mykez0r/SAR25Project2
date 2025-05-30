import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import config from '../config/config';
import User from '../models/user';
import Item from '../models/item';

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
      socket.on('newUser:username', async (usernameFromClient: string) => {
        try {
          // Mark user as online in DB
          await User.findOneAndUpdate({ username: usernameFromClient }, { online: true });

          // Update socket maps
          this.socketIDbyUsername.set(usernameFromClient, socket.id);
          this.usernamebySocketID.set(socket.id, usernameFromClient);

          // Broadcast to all clients about the new logged-in user
          const user = await User.findOne({ username: usernameFromClient });
          if (user) {
            this.newLoggedUserBroadcast({
              _id: user._id,
              username: user.username,
              name: user.name,
            });
          }
        } catch (err) {
          console.error('Error handling newUser:username:', err);
        }
      });

      // Handle bid event
      socket.on('send:bid', async (bidData) => {
        console.log("send:bid -> Received event send:bid with data = ", bidData);
        // Example: update item bid in DB, then broadcast items update
        // await Item.findByIdAndUpdate(bidData.itemId, { currentbid: bidData.amount, wininguser: username });
        // Optionally, check if item is sold and emit 'item:sold'
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log("User disconnected");
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
          // Mark user as offline in DB
          await User.findOneAndUpdate({ username }, { online: false });
          this.userLoggedOutBroadcast({ username });
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
        // Fetch all items and emit to all clients
        const items = await Item.find({}, { __v: 0 });
        if (this.io) {
          this.io.emit('items:update', items);
        }
        // Optionally, check for sold items and emit 'item:sold'
        // Example:
        // items.forEach(item => {
        //   if (item.sold) {
        //     this.io?.emit('item:sold', item);
        //   }
        // });
      } catch (err) {
        console.error('Error in auction timer:', err);
      }
    }, 1000);
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