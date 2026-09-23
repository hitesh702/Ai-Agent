import "./Contact.css";

function Contact() {
  return (
    <section className="section contact">
      <div className="container">
        <h2>Contact</h2>
        <p>Tell us about your business. We will help you get started with CallAI.</p>

        <form
          className="contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            alert("Thanks! This is a simple demo form.");
          }}
        >
          <label>
            Name
            <input type="text" name="name" required placeholder="Your name" />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              required
              placeholder="you@business.com"
            />
          </label>

          <label>
            Message
            <textarea
              name="message"
              rows="4"
              required
              placeholder="How can we help?"
            />
          </label>

          <button className="btn btn-primary" type="submit">
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}

export default Contact;
