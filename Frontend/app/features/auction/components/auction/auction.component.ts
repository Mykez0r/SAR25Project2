import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

// Import services from the barrel file
import { AuctionService, SocketService, SigninService } from '../../../../core/services';

// Import models from the barrel file 
import { Item, User, Chat, Marker } from '../../../../core/models';

@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css'],
  standalone: false
})
export class AuctionComponent implements OnInit, OnDestroy {
  items: Item[]; //array of items to store the items.
  users: User[];
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination : string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean;  //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item
  bidForm! : FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  private updateItemsSubscription!: Subscription;
  private newUserSubscription!: Subscription;
  private userLoggedOutSubscription!: Subscription;
  private receiveMessageSubscription!: Subscription;
  private itemSoldSubscription!: Subscription;

  constructor( private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
   private signinservice: SigninService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination ="";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }

ngOnInit(): void {
  this.message = "Hello " + this.userName + "! Welcome to the SAR auction site.";

  	 //create bid form
  	 this.bidForm = this.formBuilder.group({
      bid: ['', Validators.compose([Validators.required,Validators.pattern("^[0-9]*$")])]
  	 });


  	 // Get initial item data from the server api using http call in the auctionservice
     this.auctionservice.getItems()
        .subscribe({next: result => {
          let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
            this.items = receiveddata;
            console.log ("getItems Auction Component -> received the following items: ", receiveddata);
        },
        error: error => this.errorMessage = <any>error });

     // Get initial list of logged in users for googleMaps using http call in the auctionservice
      this.auctionservice.getUsers()
        .subscribe({
          next: result => {
          let receiveddata = result as User[]; // cast the received data as an array of users (must be sent like that from server)
            console.log("getUsers Auction Component -> received the following users: ", receiveddata);
          // do the rest of the needed processing here
        },
        error: error => this.errorMessage = <any>error });

  //subscribe to the incoming websocket events

  //example how to subscribe to the server side regularly (each second) items:update event
this.updateItemsSubscription = this.socketservice.getEvent("items:update")
  .subscribe(data => {
    let receiveddata = data as Item[];
    this.items = receiveddata;
  });

  // Subscribe to the new user logged in event sent from the server
  this.newUserSubscription = this.socketservice.getEvent("new:user")
    .subscribe((user: User) => {
      // Optionally update users list or show a notification
      this.socketservice.sendNewUser(this.userName);
      this.users.push(user);
      this.message = `User ${user.username} has logged in.`;
    });

  // Subscribe to the user logged out event sent from the server
  this.userLoggedOutSubscription = this.socketservice.getEvent("user:loggedOut")
    .subscribe((user: User) => {
      // Remove user from users list or show a notification
      this.socketservice.onUserLogout(this.userName);
      this.users = this.users.filter(u => u.username !== user.username);
      this.message = `User ${user.username} has logged out.`;
    });

  // Subscribe to a receive:message event to receive message events sent by the server
  this.receiveMessageSubscription = this.socketservice.getEvent("receive:message")
    .subscribe((chat: Chat) => {
      this.chats.push(chat);
      this.message = `New message from ${chat.sender}: ${chat.message}`;
    });

  // Subscribe to the item sold event sent by the server for each item that ends
  this.itemSoldSubscription = this.socketservice.getEvent("item:sold")
    .subscribe((item: Item) => {
      this.soldHistory.push(`Item "${item.description}" was sold!`);
      this.message = `Item "${item.description}" was sold!`;
      // Optionally update items list if needed
      const idx = this.items.findIndex(i => i.description === item.description);
      if (idx !== -1) {
        this.items[idx] = item;
      }
    });
  }

  ngOnDestroy(): void {
    this.updateItemsSubscription?.unsubscribe();
    this.newUserSubscription?.unsubscribe();
    this.userLoggedOutSubscription?.unsubscribe();
    this.receiveMessageSubscription?.unsubscribe();
    this.itemSoldSubscription?.unsubscribe();
  }

   logout(){
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
  	//perform any needed logout logic here
  	this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item){
  	console.log("Selected item = ", item);
  	this.selectedItem = item;
  	this.showBid = true; // makes the bid form appear
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 
  onMessageSender(ClickedChat: Chat) {
    // Set the destination to the sender of the selected received message
    this.destination = ClickedChat.sender;
    // Optionally, show the message form to reply
    this.showMessage = true;
    // Optionally, prefill the message input or show a notification
    this.message = `Replying to ${ClickedChat.sender}`;
  }

  // function called when the submit bid button is pressed
   submit(){
  	  if (!this.selectedItem || !this.bidForm.value.bid) {
        this.message = "Please select an item and enter a bid.";
        return;
      }
    const bidAmount = Number(this.bidForm.value.bid);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      this.message = "Please enter a valid bid amount.";
      return;
    }
  // Send the bid event using the socket service
    this.socketservice.onPlaceBid(this.selectedItem.description, bidAmount, this.userName);
    this.message = `Bid of ${bidAmount} submitted for "${this.selectedItem.description}".`;
    this.bidForm.reset();
  }
  //function called when the user presses the send message button
  sendMessage(){
    console.log("Message  = ", this.ChatMessage);
  }

  //function called when the cancel bid button is pressed.
   cancelBid(){
   	this.bidForm.reset(); //clears bid value
   }

   //function called when the buy now button is pressed.

   buyNow(){
   	this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
   		bid: this.selectedItem.buynow
   	});
   	this.message= this.userName + " please press the Submit Bid button to procced with the Buy now order.";
   }
  //function called when the remove item button is pressed.
    removeItem() {
      if (!this.selectedItem) {
        this.message = "Please select an item to remove.";
        return;
      }
      this.socketservice.removeItem(this.selectedItem.description);
    }
  

  /**
   * Calculate the time progress percentage for the auction item
   * @param item The auction item
   * @returns A number between 0-100 representing progress percentage
   */
  getTimeProgress(item: Item): number {
    if (!item || !item.remainingtime) {
      return 0;
    }

    const maxTime = 3600000; // Assuming initial time is 1 hour (3600000 ms)
    const remainingTime = item.remainingtime;
    
    // Calculate elapsed time as a percentage
    const elapsedPercentage = ((maxTime - remainingTime) / maxTime) * 100;
    
    // Return a percentage value between 0-100
    return Math.min(Math.max(elapsedPercentage, 0), 100);
  }

  /**
   * Determine the color of the progress bar based on remaining time
   * @param item The auction item
   * @returns Material color for the progress bar
   */
  getTimeProgressColor(item: Item): string {
    if (!item || !item.remainingtime) {
      return 'warn'; // Red when no time or item data
    }

    // More than 50% time remaining - show green
    if (item.remainingtime > 1800000) {
      return 'primary'; // Blue
    } 
    // Between 25% and 50% time remaining - show accent (amber)
    else if (item.remainingtime > 900000) {
      return 'accent';
    } 
    // Less than 25% time remaining - show red
    else {
      return 'warn'; // Red
    }
  }

}
