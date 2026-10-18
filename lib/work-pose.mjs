// Shuffle small pairs so simultaneous agents get variety without a fixed order.
export class WorkPosePool{
 constructor(random=Math.random){this.random=random;this.bag=[];}
 next(){if(!this.bag.length)this.bag=this.random()<.5?['keyboard-full','keyboard-half']:['keyboard-half','keyboard-full'];return this.bag.pop();}
}
