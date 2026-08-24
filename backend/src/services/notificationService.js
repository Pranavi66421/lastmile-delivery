const nodemailer = require('nodemailer');
const { run } = require('../config/db');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.error('Failed to initialize Twilio client:', err);
  }
}

async function logNotification(orderId, type, recipient, message) {
  await run(
    'INSERT INTO notification_logs (order_id, type, recipient, message) VALUES (?, ?, ?, ?)',
    [orderId, type, recipient, message]
  );
}

function wrapEmail(orderId, title, contentHtml) {
  return `
    <div style="font-family: 'Outfit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); max-width: 550px; margin: 15px auto; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 1.15rem; font-weight: 700; color: #818cf8;">Think Last-Mile</span>
        <span style="font-size: 0.7rem; color: #cbd5e1; font-weight: 600; text-transform: uppercase; background-color: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99,102,241,0.25); padding: 2px 8px; border-radius: 12px;">Order #${orderId}</span>
      </div>
      <h2 style="font-size: 1.25rem; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 15px; border: none; padding: 0;">${title}</h2>
      <div style="font-size: 0.85rem; line-height: 1.6; color: #cbd5e1;">
        ${contentHtml}
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 25px; font-size: 0.7rem; color: #94a3b8; text-align: center;">
        This is an automated notification from your Think Last-Mile logistics dashboard.
      </div>
    </div>
  `;
}

async function triggerOrderStatusNotifications(order, newStatus, remarks = '') {
  const customerEmail = order.customer_email || 'customer@example.com';
  const customerPhone = order.customer_phone || '+15550000';
  const orderId = order.id;

  let emailSubject = '';
  let emailHtml = '';
  let smsText = '';

  switch (newStatus) {
    case 'Created':
      emailSubject = `Order Created Successfully - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Order Placed Successfully', `
        <p>Your delivery request has been logged in our system. A courier will be assigned shortly.</p>
        <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin: 15px 0;">
          <div style="margin-bottom: 6px;">📍 <strong>Pickup:</strong> ${order.pickup_address}</div>
          <div style="margin-bottom: 6px;">🎯 <strong>Drop-off:</strong> ${order.drop_address}</div>
          <div style="margin-bottom: 6px;">📦 <strong>SLA / Weight:</strong> ${order.order_type} | ${order.billing_weight} kg</div>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 8px 0;" />
          <div style="display: flex; justify-content: space-between; font-weight: 700; color: #34d399; font-size: 0.95rem;">
            <span>Total Charge:</span>
            <span>$${order.total_charge.toFixed(2)}</span>
          </div>
        </div>
      `);
      smsText = `Order #${orderId} created successfully. Charge: $${order.total_charge.toFixed(2)}. We will notify you when a rider is assigned!`;
      break;

    case 'Assigned':
      emailSubject = `Courier Assigned to Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Courier Dispatched', `
        <p>A delivery agent has been matched to your order and is currently heading to the pickup location.</p>
        <div style="background-color: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          <div style="font-weight: 600; color: #fff;">🏍️ Courier Assigned: <strong>${order.agent_name}</strong></div>
          <div style="font-size: 0.75rem; color: #fbbf24; margin-top: 4px;">Rider Rating: ⭐ ${order.agent_rating || '5.0'}</div>
        </div>
      `);
      smsText = `Rider ${order.agent_name} has been assigned to your order #${orderId} and is heading to pick up.`;
      break;

    case 'Picked Up':
      emailSubject = `Your Package Has Been Picked Up - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Package Picked Up', `
        <p>Our courier <strong>${order.agent_name}</strong> has picked up your package. The shipment is now on the move.</p>
        <div style="font-size: 0.8rem; color: #94a3b8; border-left: 2px solid #f59e0b; padding-left: 10px; margin: 15px 0;">
          Next step: Transit scanning and route dispatching.
        </div>
      `);
      smsText = `Rider ${order.agent_name} has picked up your package for order #${orderId}. It is now en route!`;
      break;

    case 'In Transit':
      emailSubject = `Transit Update - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Transit Update', `
        <p>Your order is currently in transit. Status update from route:</p>
        <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin: 15px 0; font-style: italic;">
          "${remarks || 'Normal transit schedule'}"
        </div>
      `);
      smsText = `Order #${orderId} is en route. Status: ${remarks || 'Normal'}.`;
      break;

    case 'Out for Delivery':
      emailSubject = `Order Out for Delivery - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Out for Final Delivery', `
        <p>Get ready! Courier <strong>${order.agent_name}</strong> is out for the final delivery run to your address.</p>
        <div style="background-color: rgba(236, 72, 153, 0.05); border: 1px solid rgba(236, 72, 153, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          📍 <strong>Drop Address:</strong> ${order.drop_address}
        </div>
      `);
      smsText = `Your package #${orderId} is out for final delivery with ${order.agent_name}.`;
      break;

    case 'Delivered':
      emailSubject = `Delivered! - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Order Delivered Successfully 🎉', `
        <p style="color: #34d399; font-weight: 600; font-size: 0.95rem; margin-top: 0;">Delivered!</p>
        <p>Your package has been successfully dropped off at the destination by courier <strong>${order.agent_name}</strong>.</p>
        <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          Thank you for choosing Think Last-Mile logistics! Please rate your rider on your active dashboard view.
        </div>
      `);
      smsText = `Order #${orderId} has been successfully delivered. Rate your rider ${order.agent_name} on the app!`;
      break;

    case 'Failed':
      emailSubject = `Delivery Failed Attempt - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Delivery Attempt Unsuccessful ⚠️', `
        <p style="color: #f87171; font-weight: 600; font-size: 0.95rem; margin-top: 0;">Unsuccessful Attempt</p>
        <p>We attempted to deliver your order but were unsuccessful.</p>
        <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          ❌ <strong>Reason for failure:</strong> ${remarks || 'Recipient unavailable'}<br/>
          📅 Please open your tracker dashboard to reschedule for a new date.
        </div>
      `);
      smsText = `Delivery attempt failed for order #${orderId} (Reason: ${remarks || 'Unsuccessful'}). Please reschedule on the dashboard.`;
      break;
  }

  if (emailSubject) {
    // Log SMS and Email to local sqlite audit
    await logNotification(orderId, 'Email', customerEmail, `Subject: ${emailSubject}\n\n${emailHtml}`);
    await logNotification(orderId, 'SMS', customerPhone, smsText);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@thinklastmile.com',
          to: customerEmail,
          subject: emailSubject,
          html: emailHtml
        });
      } catch (err) {
        console.error('Nodemailer SMTP dispatch error:', err);
      }
    }

    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customerPhone
        });
        console.log(`Twilio SMS sent to ${customerPhone}`);
      } catch (err) {
        console.error('Twilio SMS dispatch error:', err);
      }
    }
  }
}

module.exports = {
  triggerOrderStatusNotifications
};
