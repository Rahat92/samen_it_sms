// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: 'penguin.samenits.net',
//   port: 587,
//   secure: false,
//   auth: {
//     user: 'alert@samenits.net',
//     pass: 'cikhrejWtl7t1mostYZS'
//   },
//   tls: {
//     // minVersion: "TLSv1.2",
//     rejectUnauthorized: false,
//   },
// });


// const mailOptions = {
//   from: 'alert@samenits.com',
//   to: 'khrahat150@gmail.com',
//   subject: 'Hello from Nodemailer',
//   text: 'This is a test email',
//   html: '<b>This is a test email</b>'
// };

// transporter.sendMail(mailOptions, (error, info) => {
//   if (error) {
//     return console.log(error);
//   }
//   console.log(info.messageId);
// });