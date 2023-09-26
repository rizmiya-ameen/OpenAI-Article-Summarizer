import { configureStore } from "@reduxjs/toolkit";
import { articleApi } from "./article";

export const store = configureStore ({
  reducer: {
    [articleApi.reducerPath]: articleApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(articleApi.middleware)
})

/*
setting up a Redux store and an API using the Redux Toolkit and the @reduxjs/toolkit/query package for handling asynchronous data fetching

we are configuring a store, store is a global state, that stores entire information of our application. but in most cases we dont need the entire state. we neeed to reduce it to a specific slice of the pie. in this case it is going to be the articleApi. meaning we want to get just something from this API.  to be able to make this work, we add it as the reducer
*/