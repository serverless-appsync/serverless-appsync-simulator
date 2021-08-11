CREATE TABLE posts (
  id INT PRIMARY KEY NOT NULL,
  user_id INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);

INSERT INTO posts (id, user_id, title, body) VALUES (1,1,'Title','A body paragraph');
