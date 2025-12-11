# What Happens When You Choose "Multiple Deliveries"

## 🎯 When You Select "Multiple Deliveries" Type

### 1. **UI Changes Immediately**

When you select **"Multiple Deliveries (Several Locations)"** from the Delivery Type dropdown:

- ✅ A message appears: *"You'll be able to add multiple delivery points below"*
- ✅ A new section appears: **"Delivery Points Manager"**
- ✅ An **"Add Delivery Point"** button becomes available

---

### 2. **Delivery Points Manager Section Appears**

A new interactive section appears where you can:

#### **Add Multiple Delivery Points**
- Click **"Add Delivery Point"** button to add as many delivery locations as needed
- Each delivery point gets a number (1, 2, 3, etc.)

#### **For Each Delivery Point, You Can Enter:**

**📍 Location Information:**
- Location Name (required)
- Location ID (optional)
- Full Address (required)
- City, State, ZIP
- Phone number
- Contact Name & Phone

**📦 Load Quantities for THIS Delivery Point:**
- Weight (kg or lbs)
- Number of Pieces
- Number of Pallets
- Number of Boxes
- Number of Carts
- Volume (cubic meters)

**⏰ Delivery Timing:**
- Scheduled Delivery Date
- Scheduled Delivery Time
- Time Window (start & end time)
- Appointment Required (yes/no)
- Appointment Time (if required)

**📋 Delivery Instructions:**
- Delivery Instructions
- Special Handling Requirements
- Requires Liftgate (yes/no)
- Requires Inside Delivery (yes/no)
- Reference Number
- Notes

**🎯 Other Details:**
- Delivery Type (delivery/pickup)
- Priority Level
- Status

---

### 3. **When You Submit the Form**

#### **Step 1: Load is Created**
- The main load record is saved with:
  - `delivery_type = "multi"`
  - `company_name` (the company you entered)
  - `total_delivery_points` = number of delivery points you added

#### **Step 2: Each Delivery Point is Saved**
- Each delivery point you added is saved as a separate record in the `load_delivery_points` table
- Each point is linked to the main load via `load_id`
- Each point has its own `delivery_number` (1, 2, 3, etc.)

#### **Step 3: Validation**
- The system checks that all delivery points have:
  - Location Name ✅
  - Address ✅
- If any point is missing required fields, you'll see an error message

---

### 4. **What You See on the Load Detail Page**

After creating a multi-delivery load, when you view it:

#### **Load Summary Card**
Shows totals across ALL delivery points:
- Total Delivery Points: 3
- Total Weight: 15,000 kg
- Total Pieces: 150
- Total Pallets: 25

#### **Delivery Points Breakdown Section**
Lists each delivery point with:
- Delivery Number (#1, #2, #3)
- Location Name & Address
- Load Amount for that point (weight, pieces, pallets, etc.)
- Scheduled Delivery Date & Time
- Time Window
- Delivery Instructions
- Status

#### **Route Map**
- Shows the origin
- Shows ALL delivery points as stops on the map
- Shows the final destination
- Displays the complete route with all stops

---

### 5. **Example Scenario**

**Scenario:** Delivering to 3 Costco stores

1. **Select "Multiple Deliveries"**
2. **Enter Company Name:** "Costco Wholesale"
3. **Add Delivery Point #1:**
   - Location: "Costco - Downtown"
   - Address: "123 Main St, New York, NY"
   - Weight: 5,000 kg
   - Pieces: 50
   - Delivery Date: Jan 15, 2024
   - Time Window: 9:00 AM - 12:00 PM

4. **Add Delivery Point #2:**
   - Location: "Costco - Uptown"
   - Address: "456 Oak Ave, New York, NY"
   - Weight: 5,000 kg
   - Pieces: 50
   - Delivery Date: Jan 15, 2024
   - Time Window: 1:00 PM - 4:00 PM

5. **Add Delivery Point #3:**
   - Location: "Costco - Brooklyn"
   - Address: "789 Pine St, Brooklyn, NY"
   - Weight: 5,000 kg
   - Pieces: 50
   - Delivery Date: Jan 16, 2024
   - Time Window: 9:00 AM - 12:00 PM

6. **Submit** → All 3 delivery points are saved and linked to the load

7. **View Load** → See all 3 points on the map and in the breakdown list

---

### 6. **Key Differences: Single vs Multiple**

| Feature | Single Delivery | Multiple Deliveries |
|---------|----------------|---------------------|
| Delivery Type | One location | Multiple locations |
| Company Name | Optional | Recommended |
| Delivery Points Section | Hidden | Visible |
| Map Display | Origin → Destination | Origin → Stop 1 → Stop 2 → ... → Destination |
| Load Summary | Basic info | Summary + breakdown by point |
| Quantities | One total | Split across points |

---

### 7. **Benefits of Multiple Deliveries**

✅ **Track each delivery separately**
✅ **See quantities per location**
✅ **Manage time windows per stop**
✅ **View complete route on map**
✅ **Track delivery status per point**
✅ **Better planning and scheduling**

---

## 🚀 Ready to Use!

The system is fully functional. Just:
1. Select "Multiple Deliveries"
2. Add your delivery points
3. Fill in details for each point
4. Submit and view the complete route!

